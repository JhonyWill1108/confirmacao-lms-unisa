import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Person } from '@/types';

interface AuthContextType {
  isAuthenticated: boolean;
  userType: 'admin' | 'coordinator' | null;
  userData: Person | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userType, setUserType] = useState<'admin' | 'coordinator' | null>(null);
  const [userData, setUserData] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Auto-logout após 5 minutos de inatividade
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });

    const checkInactivity = setInterval(() => {
      const inactiveTime = Date.now() - lastActivity;
      if (inactiveTime > 5 * 60 * 1000) { // 5 minutos
        logout();
      }
    }, 60000); // Check every minute

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(checkInactivity);
    };
  }, [isAuthenticated, lastActivity]);

  useEffect(() => {
    // Check if user is already logged in (localStorage)
    const storedAuth = localStorage.getItem('auth');
    if (storedAuth) {
      const auth = JSON.parse(storedAuth);
      setIsAuthenticated(true);
      setUserType(auth.userType);
      setUserData(auth.userData);
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log('Tentando login com:', username);
      
      // Check user-admin collection first
      const adminQuery = query(
        collection(db, 'user-admin'),
        where('login', '==', username)
      );
      const adminSnapshot = await getDocs(adminQuery);
      
      if (!adminSnapshot.empty) {
        const adminData = {
          id: adminSnapshot.docs[0].id,
          ...adminSnapshot.docs[0].data(),
        } as Person;
        
        console.log('Admin encontrado:', { login: adminData.login });

        // Verify password
        if (adminData.senha !== password) {
          console.log('Senha incorreta');
          return false;
        }
        
        console.log('Login como Administrador');
        const authData = {
          userType: 'admin' as const,
          userData: adminData,
        };
        setIsAuthenticated(true);
        setUserType('admin');
        setUserData(adminData);
        setLastActivity(Date.now());
        localStorage.setItem('auth', JSON.stringify(authData));
        return true;
      }
      
      // Check user-pos collection for coordinators
      const peopleQuery = query(
        collection(db, 'user-pos'),
        where('login', '==', username)
      );
      const snapshot = await getDocs(peopleQuery);
      
      console.log('Documentos encontrados em user-pos:', snapshot.size);

      if (!snapshot.empty) {
        const personData = {
          id: snapshot.docs[0].id,
          ...snapshot.docs[0].data(),
        } as Person;
        
        console.log('Dados do usuário:', { tipo: personData.tipo, login: personData.login });

        // Verify password
        if (personData.senha !== password) {
          console.log('Senha incorreta');
          return false;
        }
        
        console.log('Senha correta, verificando tipo...');

        // Only coordinator can login from user-pos
        if (personData.tipo === 'Coordenador') {
          const authData = {
            userType: 'coordinator' as const,
            userData: personData,
          };
          setIsAuthenticated(true);
          setUserType('coordinator');
          setUserData(personData);
          setLastActivity(Date.now());
          localStorage.setItem('auth', JSON.stringify(authData));
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUserType(null);
    setUserData(null);
    localStorage.removeItem('auth');
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userType,
        userData,
        login,
        logout,
        loading,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
};
