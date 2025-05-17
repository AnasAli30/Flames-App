import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
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

const SERVER = 'http://192.168.1.5:5000';

const DashboardScreen: React.FC<DashboardScreenProps> = ({ setIsLoggedIn }) => {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [jwt, setJwt] = useState('');
  const [myCode, setMyCode] = useState('');
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadKeys = async () => {
      const token = await AsyncStorage.getItem('token');
      setJwt(token || '');
      const userStr = await AsyncStorage.getItem('user');
      console.log("userStr" ,userStr);
      if (userStr) {
        const user = JSON.parse(userStr);
        setPrivateKeyPem(user.privateKey);
        setMyCode(user.code);
      }
    };
    loadKeys();
  }, []);

  useEffect(() => {
    console.log("jwt" ,jwt);
    console.log("privateKeyPem" ,privateKeyPem);
    console.log("myCode" ,myCode);
    if (jwt && privateKeyPem && myCode) {
      console.log(jwt, privateKeyPem, myCode);
      fetchHistory();
      startPolling();
      return () => stopPolling();
    }
  }, [jwt, privateKeyPem, myCode]);

  const startPolling = () => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(fetchMessages, 3000);
    fetchMessages();
  };
  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = null;
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${SERVER}/fetch-messages`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      console.log(data);
      if (Array.isArray(data.messages)) {
        const privKey = forge.pki.privateKeyFromPem(privateKeyPem);
        const decryptedMsgs = data.messages.map((msg: Message) => {
          try {
            const aesKey = privKey.decrypt(forge.util.decode64(msg.encryptedAESKey), 'RSA-OAEP');
            const encryptedBytes = forge.util.decode64(msg.encryptedMessage);
            const iv = encryptedBytes.slice(0, 16);
            const encrypted = encryptedBytes.slice(16);
            const decipher = forge.cipher.createDecipher('AES-CBC', aesKey);
            decipher.start({ iv });
            decipher.update(forge.util.createBuffer(encrypted));
            decipher.finish();
            return { ...msg, decrypted: decipher.output.toString() };
          } catch (e) {
            return { ...msg, decrypted: '[Decryption failed]' };
          }
        });
        setMessages(prev => [...decryptedMsgs.reverse(), ...prev]);
      }
    } catch (err) {
      // ignore
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${SERVER}/message-history`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      const data = await res.json();
      if (Array.isArray(data.messages)) {
        const privKey = forge.pki.privateKeyFromPem(privateKeyPem);
        const decryptedMsgs = data.messages.map((msg: Message) => {
          try {
            const aesKey = privKey.decrypt(forge.util.decode64(msg.encryptedAESKey), 'RSA-OAEP');
            const encryptedBytes = forge.util.decode64(msg.encryptedMessage);
            const iv = encryptedBytes.slice(0, 16);
            const encrypted = encryptedBytes.slice(16);
            const decipher = forge.cipher.createDecipher('AES-CBC', aesKey);
            decipher.start({ iv });
            decipher.update(forge.util.createBuffer(encrypted));
            decipher.finish();
            return { ...msg, decrypted: decipher.output.toString() };
          } catch (e) {
            return { ...msg, decrypted: '[Decryption failed]' };
          }
        });
        setMessages(decryptedMsgs.reverse());
      }
    } catch (err) {
      // ignore
    }
  };

  const handleSend = async () => {
    if (!recipient || !message) {
      Alert.alert('Error', 'Recipient and message required.');
      return;
    }
    try {
      // 1. Get recipient public key
      const res = await fetch(`${SERVER}/public-key/${recipient}`);
      const data = await res.json();
      if (!data.publicKey) {
        Alert.alert('Error', 'Recipient not found.');
        return;
      }
      const publicKey = forge.pki.publicKeyFromPem(data.publicKey);
      // 2. Generate AES key
      const aesKey = forge.random.getBytesSync(32);
      // 3. Encrypt message with AES
      const iv = forge.random.getBytesSync(16);
      const cipher = forge.cipher.createCipher('AES-CBC', aesKey);
      cipher.start({ iv });
      cipher.update(forge.util.createBuffer(message));
      cipher.finish();
      const encryptedMessage = forge.util.encode64(iv + cipher.output.getBytes());
      // 4. Encrypt AES key with recipient's public key
      const encryptedAESKey = forge.util.encode64(publicKey.encrypt(aesKey, 'RSA-OAEP'));
      // 5. Send to backend
      const sendRes = await fetch(`${SERVER}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ to: recipient, encryptedMessage, encryptedAESKey }),
      });
      if (sendRes.ok) {
        setMessage('');
        Alert.alert('Success', 'Message sent!');
        fetchHistory();
      } else {
        Alert.alert('Error', 'Failed to send message.');
      }
    } catch (err) {
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to the Dashboard!</Text>
        <Text style={{ color: '#aaa', marginBottom: 8 }}>Your Code: {myCode}</Text>
        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
        <View style={styles.chatBox}>
          <TextInput
            style={styles.input}
            placeholder="Recipient Code"
            placeholderTextColor="#aaa"
            value={recipient}
            onChangeText={setRecipient}
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            placeholder="Type your message..."
            placeholderTextColor="#aaa"
            value={message}
            onChangeText={setMessage}
          />
          <TouchableOpacity style={[styles.button, { marginTop: 8 }]} onPress={handleSend}>
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={messages}
          keyExtractor={(_, idx) => idx.toString()}
          renderItem={({ item }) => (
            <View style={styles.msgItem}>
              <Text style={{ color: '#FF8C00', fontWeight: 'bold' }}>From: {item.from}</Text>
              <Text style={{ color: '#fff' }}>{item.decrypted}</Text>
              <Text style={{ color: '#aaa', fontSize: 10 }}>{new Date(item.timestamp).toLocaleString()}</Text>
            </View>
          )}
          style={{ flex: 1, width: '100%', marginTop: 16 }}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: '#181818',
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    color: '#FF8C00',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#FF8C00',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  chatBox: {
    width: '90%',
    backgroundColor: '#232323ee',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 44,
    backgroundColor: '#181818',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 16,
  },
  msgItem: {
    backgroundColor: '#232323',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    width: '90%',
    alignSelf: 'center',
  },
});

export default DashboardScreen; 