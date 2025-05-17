import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Alert, Image, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import RNFS from 'react-native-fs';
import { PermissionsAndroid } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';

const { width, height } = Dimensions.get('window');

function FlamesPattern() {
  const flames = [];
  for (let i = 0; i < 20; i++) {
    flames.push(
      <Text
        key={i}
        style={{
          position: 'absolute',
          top: Math.random() * height,
          left: Math.random() * width,
          color: 'rgba(255,140,0,0.08)',
          fontSize: 32 + Math.random() * 24,
          fontWeight: 'bold',
          transform: [{ rotate: `${Math.random() * 30 - 15}deg` }],
        }}
      >
        FLAME
      </Text>
    );
  }
  return <View style={StyleSheet.absoluteFill}>{flames}</View>;
}

type Props = NativeStackScreenProps<any>;

const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email || !phone || !password) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('http://192.168.1.5:5000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone, password }),
      });
      const data = await res.json();
      if (res.status === 201) {
        setUserCode(data.code);
        setQr(data.qr);
        Alert.alert('Success', 'Registration successful! Your unique code is shown below.');
      } else {
        Alert.alert('Error', data.message || 'Registration failed.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!qr) return;
    try {
      let granted = true;
      if (Platform.OS === 'android') {
        granted = (await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your storage to download the QR code.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        )) === PermissionsAndroid.RESULTS.GRANTED;
      }
      if (!granted) {
        Alert.alert('Permission denied', 'Cannot save QR code without storage permission.');
        return;
      }
      // Remove data:image/png;base64, prefix if present
      const base64 = qr.replace(/^data:image\/\w+;base64,/, '');
      const filePath = `${RNFS.DownloadDirectoryPath}/flames_qr_${userCode}.png`;
      await RNFS.writeFile(filePath, base64, 'base64');
      Alert.alert('Success', `QR code saved to: ${filePath}`);
    } catch (err) {
      Alert.alert('Error', 'Failed to save QR code.');
    }
  };

  const handleCopyCode = () => {
    if (userCode) {
      Clipboard.setString(userCode);
      Alert.alert('Copied', 'Your code has been copied to the clipboard.');
    }
  };

  return (
    <View style={styles.container}>
      <FlamesPattern />
      <View style={styles.card}>
        <Text style={styles.brand}>FLAMES</Text>
        <Text style={styles.title}>Register</Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor="#aaa"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Registering...' : 'Register'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Back to Login</Text></Text>
        </TouchableOpacity>
        {userCode && (
          <View style={{ alignItems: 'center', marginTop: 24 }}>
            <Text style={{ color: '#FF8C00', fontWeight: 'bold', fontSize: 16 }}>Your Unique Code:</Text>
            <Text style={{ color: '#fff', fontSize: 20, marginBottom: 12 }}>{userCode}</Text>
            <TouchableOpacity style={[styles.button, { marginTop: 0, width: 180, backgroundColor: '#222' }]} onPress={handleCopyCode}>
              <Text style={[styles.buttonText, { color: '#FF8C00' }]}>Copy Code</Text>
            </TouchableOpacity>
            {qr && <Image source={{ uri: qr }} style={{ width: 180, height: 180, backgroundColor: '#fff', borderRadius: 12, marginTop: 10 }} />}
            <TouchableOpacity style={[styles.button, { marginTop: 12, width: 180 }]} onPress={handleDownloadQR}>
              <Text style={styles.buttonText}>Download QR</Text>
            </TouchableOpacity>
            <Text style={{ color: '#aaa', marginTop: 8, fontSize: 13 }}>Scan this QR code to login instantly.</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '85%',
    backgroundColor: '#232323ee',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  brand: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF8C00',
    letterSpacing: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 18,
  },
  input: {
    width: '100%',
    height: 44,
    backgroundColor: '#181818',
    borderRadius: 8,
    paddingHorizontal: 12,
    color: '#fff',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#333',
    fontSize: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#FF8C00',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    letterSpacing: 1,
  },
  linkText: {
    color: '#aaa',
    marginTop: 8,
    fontSize: 15,
  },
  link: {
    color: '#FF8C00',
    fontWeight: 'bold',
  },
});

export default RegisterScreen; 