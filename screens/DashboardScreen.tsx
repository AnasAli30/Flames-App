import React, {useEffect, useState, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  FlatList,
  ImageBackground,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import forge from 'node-forge';

interface DashboardScreenProps {
  setIsLoggedIn: (val: boolean) => void;
}

interface Message {
  from: string;
  encryptedMessage: string;
  encryptedAESKey: string;
  timestamp: number;
  decrypted?: string;
}

const SERVER = 'http://192.168.1.8:5000';

const DashboardScreen: React.FC<DashboardScreenProps> = ({setIsLoggedIn}) => {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [jwt, setJwt] = useState('');
  const [myCode, setMyCode] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadStoredData = async () => {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');

      if (token) setJwt(token);
      if (userStr) {
        const user = JSON.parse(userStr);
        setPrivateKeyPem(user.privateKey);
        setMyCode(user.code);
      }
    };

    loadStoredData();
  }, []);

  useEffect(() => {
    if (jwt && privateKeyPem && myCode) {
      fetchMessageHistory();
      startPolling();

      return () => stopPolling();
    }
  }, [jwt, privateKeyPem, myCode]);

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(fetchNewMessages, 3000);
    fetchNewMessages();
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const decryptMessage = (msg: Message): Message => {
    try {
      const privKey = forge.pki.privateKeyFromPem(privateKeyPem);
      const aesKey = privKey.decrypt(
        forge.util.decode64(msg.encryptedAESKey),
        'RSA-OAEP',
      );

      const encryptedBytes = forge.util.decode64(msg.encryptedMessage);
      const iv = encryptedBytes.slice(0, 16);
      const encrypted = encryptedBytes.slice(16);

      const decipher = forge.cipher.createDecipher('AES-CBC', aesKey);
      decipher.start({iv});
      decipher.update(forge.util.createBuffer(encrypted));
      decipher.finish();

      return {...msg, decrypted: decipher.output.toString()};
    } catch {
      return {...msg, decrypted: '[Decryption failed]'};
    }
  };

  const fetchNewMessages = async () => {
    try {
      const res = await fetch(`${SERVER}/fetch-messages`, {
        headers: {Authorization: `Bearer ${jwt}`},
      });
      const data = await res.json();

      if (Array.isArray(data.messages)) {
        const decrypted = data.messages.map(decryptMessage);
        setMessages(prev => [...decrypted.reverse(), ...prev]);
      }
    } catch {
      // Ignore fetch error silently
    }
  };

  const fetchMessageHistory = async () => {
    try {
      const res = await fetch(`${SERVER}/message-history`, {
        headers: {Authorization: `Bearer ${jwt}`},
      });
      const data = await res.json();

      if (Array.isArray(data.messages)) {
        const decrypted = data.messages.map(decryptMessage);
        setMessages(decrypted.reverse());
      }
    } catch {
      // Ignore fetch error silently
    }
  };

  const handleSend = async () => {
    if (!recipient || !message) {
      Alert.alert('Error', 'Recipient and message required.');
      return;
    }

    try {
      const res = await fetch(`${SERVER}/public-key/${recipient}`);
      const data = await res.json();

      if (!data.publicKey) {
        Alert.alert('Error', 'Recipient not found.');
        return;
      }

      const publicKey = forge.pki.publicKeyFromPem(data.publicKey);
      const aesKey = forge.random.getBytesSync(32);
      const iv = forge.random.getBytesSync(16);

      const cipher = forge.cipher.createCipher('AES-CBC', aesKey);
      cipher.start({iv});
      cipher.update(forge.util.createBuffer(message));
      cipher.finish();

      const encryptedMessage = forge.util.encode64(
        iv + cipher.output.getBytes(),
      );
      const encryptedAESKey = forge.util.encode64(
        publicKey.encrypt(aesKey, 'RSA-OAEP'),
      );

      const sendRes = await fetch(`${SERVER}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          to: recipient,
          encryptedMessage,
          encryptedAESKey,
        }),
      });

      if (sendRes.ok) {
        setMessage('');
        Alert.alert('Success', 'Message sent!');
        fetchMessageHistory();
      } else {
        Alert.alert('Error', 'Failed to send message.');
      }
    } catch {
      Alert.alert('Error', 'Failed to send message.');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    setIsLoggedIn(false);
    Alert.alert('Logged out', 'You have been logged out.');
  };

  return (
    <ImageBackground
      source={require('../assets/images/1.jpg')}
      style={styles.container}
      resizeMode="cover">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.innerContainer}>
        <Image
          source={require('../assets/images/logo.jpg')}
          style={styles.logo}
        />

        <Text style={styles.title}>FLAMES</Text>
        <Text style={styles.userCode}>Your Code: {myCode}</Text>

        <View style={styles.chatBox}>
          <TextInput
            style={styles.input}
            placeholder="Recipient Code"
            placeholderTextColor="#ddd"
            value={recipient}
            onChangeText={setRecipient}
          />
          <TextInput
            style={[styles.input, styles.messageInput]}
            placeholder="Type your message..."
            placeholderTextColor="#ddd"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(_, i) => i.toString()}
          style={styles.messageList}
          contentContainerStyle={{paddingBottom: 20}}
          renderItem={({item}) => (
            <View style={styles.messageItem}>
              <Text style={styles.messageFrom}>From: {item.from}</Text>
              <Text style={styles.messageText}>{item.decrypted}</Text>
              <Text style={styles.messageTime}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            </View>
          )}
        />

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  userCode: {
    color: '#eee',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  chatBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 12,
  },
  messageInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#3498db',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  messageList: {
    flex: 1,
    marginBottom: 10,
  },
  messageItem: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: {width: 0, height: 2},
  },
  messageFrom: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  messageText: {
    fontSize: 16,
    color: '#444',
    marginBottom: 6,
  },
  messageTime: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
  },
});

export default DashboardScreen;
