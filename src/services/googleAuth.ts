import { GoogleSignin } from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

export const configureGoogleSignIn = (): void => {
  const webClientId = Constants.expoConfig?.extra?.googleWebClientId as string | undefined;
  GoogleSignin.configure({
    webClientId,
    scopes: [DRIVE_FILE_SCOPE],
    offlineAccess: false,
  });
};

export const signIn = async (): Promise<{
  name: string | null;
  email: string;
  photo: string | null;
} | null> => {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (response.type === "cancelled") return null;
  return {
    name: response.data.user.name,
    email: response.data.user.email,
    photo: response.data.user.photo,
  };
};

export const signOut = async (): Promise<void> => {
  await GoogleSignin.signOut();
};

export const isSignedIn = (): boolean => {
  return GoogleSignin.hasPreviousSignIn();
};

export const getCurrentUser = (): {
  name: string | null;
  email: string;
  photo: string | null;
} | null => {
  const user = GoogleSignin.getCurrentUser();
  if (!user) return null;
  return {
    name: user.user.name,
    email: user.user.email,
    photo: user.user.photo,
  };
};

export const getAccessToken = async (): Promise<string> => {
  const tokens = await GoogleSignin.getTokens();
  return tokens.accessToken;
};
