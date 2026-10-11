import * as SecureStore from 'expo-secure-store';
import {Platform} from 'react-native';
import {api,SessionUser} from '../lib/api';
const TOKEN='opustia.access-token'; const USER='opustia.session-user';
const isWeb=Platform.OS==='web';
async function setValue(key:string,value:string){if(isWeb)globalThis.localStorage?.setItem(key,value);else await SecureStore.setItemAsync(key,value)}
async function getValue(key:string){return isWeb?globalThis.localStorage?.getItem(key)||null:await SecureStore.getItemAsync(key)}
export async function saveSession(accessToken:string,user:SessionUser){await setValue(TOKEN,accessToken);await setValue(USER,JSON.stringify(user))}
export async function readSession(){const [accessToken,raw]=await Promise.all([getValue(TOKEN),getValue(USER)]);return accessToken&&raw?{accessToken,user:JSON.parse(raw) as SessionUser}:null}
export async function clearSession(){if(isWeb){globalThis.localStorage?.removeItem(TOKEN);globalThis.localStorage?.removeItem(USER)}else{await SecureStore.deleteItemAsync(TOKEN);await SecureStore.deleteItemAsync(USER)}}
export async function restoreValidatedSession(){const session=await readSession();if(!session)return null;try{const result=await api.getCurrentUser(session.accessToken);if(!result.user)throw new Error('Session is no longer valid');await saveSession(session.accessToken,result.user);return{...session,user:result.user}}catch{await clearSession();return null}}
export async function login(email:string,password:string){const result=await api.login(email,password);await saveSession(result.accessToken,result.user);return result.user}
export async function register(name:string,email:string,password:string){const result=await api.register(name,email,password);await saveSession(result.accessToken,result.user);return result.user}
