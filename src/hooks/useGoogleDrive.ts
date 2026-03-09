import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  signIn as googleSignIn,
  signOut as googleSignOut,
  isSignedIn as checkSignedIn,
  getCurrentUser,
} from "@/services/googleAuth";
import {
  getGoogleDriveEnabled,
  setGoogleDriveEnabled,
  getWifiOnlyUpload,
  setWifiOnlyUpload,
} from "@/utils/settingsStore";
import { processUploadQueue } from "@/services/uploadManager";

export type GoogleDriveUser = {
  name: string | null;
  email: string;
  photo: string | null;
};

export const useGoogleDrive = () => {
  const [user, setUser] = useState<GoogleDriveUser | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState(false);
  const [wifiOnly, setWifiOnly] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const si = checkSignedIn();
      setSignedIn(si);
      setUser(si ? getCurrentUser() : null);
      setUploadEnabled(getGoogleDriveEnabled());
      setWifiOnly(getWifiOnlyUpload());
    }, []),
  );

  const handleSignIn = async () => {
    const result = await googleSignIn();
    if (result) {
      setUser(result);
      setSignedIn(true);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setUser(null);
    setSignedIn(false);
    setUploadEnabled(false);
    setGoogleDriveEnabled(false);
  };

  const toggleUploadEnabled = (value: boolean) => {
    setUploadEnabled(value);
    setGoogleDriveEnabled(value);
    if (value) {
      processUploadQueue().catch(() => {});
    }
  };

  const toggleWifiOnly = (value: boolean) => {
    setWifiOnly(value);
    setWifiOnlyUpload(value);
  };

  return {
    user,
    signedIn,
    uploadEnabled,
    wifiOnly,
    handleSignIn,
    handleSignOut,
    toggleUploadEnabled,
    toggleWifiOnly,
  };
};
