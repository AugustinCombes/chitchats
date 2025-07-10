import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export default function Index() {
  // Get base path from config for web
  const basePath = Platform.OS === 'web' 
    ? (Constants.expoConfig?.extra?.basePath || '/')
    : '/';
  
  return <Redirect href={`${basePath}conversation`} />;
}