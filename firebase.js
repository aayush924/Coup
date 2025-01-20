import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAvtSJTlQb3a8JdHm7_AlBtOZVWlyP2mHM",
    authDomain: "coup-app-3f190.firebaseapp.com",
    projectId: "coup-app-3f190",
    storageBucket: "coup-app-3f190.firebasestorage.app",
    messagingSenderId: "116071435555",
    appId: "1:116071435555:web:16c78a3066b7eb57ff1096"
};  

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };