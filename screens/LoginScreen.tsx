import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Dimensions, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

function FlamesPattern() {
  // Render 'FLAME' text in various positions for a pattern effect
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

type Props = NativeStackScreenProps<any> & { setIsLoggedIn: (val: boolean) => void };

const LoginScreen: React.FC<Props> = ({ navigation, setIsLoggedIn }) => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!code || !password) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('http://192.168.1.5:5000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user)); // <-- Save user object
        setIsLoggedIn(true);
        Alert.alert('Success', 'Login successful.');
      } else {
        Alert.alert('Error', data.message || 'Login failed.');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlamesPattern />
      <View style={styles.card}>
        <Text style={styles.brand}>FLAMES</Text>
        <Text style={styles.title}>Login</Text>
        <TextInput
          style={styles.input}
          placeholder="Code"
          placeholderTextColor="#aaa"
          value={code}
          onChangeText={setCode}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Log In'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.link}>Sign Up</Text></Text>
        </TouchableOpacity>
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

export default LoginScreen; 