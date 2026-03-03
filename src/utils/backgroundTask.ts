import BackgroundService from "react-native-background-actions";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const backgroundTask = async (): Promise<void> => {
  // Keep JS thread alive while recording in background.
  // Actual metering is handled by the existing setInterval polling in useRecorder.
  while (BackgroundService.isRunning()) {
    await sleep(1000); // oxlint-disable-line no-await-in-loop -- intentional sequential polling to keep JS thread alive
  }
};

const options = {
  taskName: "SoundLevelRecorder",
  taskTitle: "録音中",
  taskDesc: "バックグラウンドで騒音レベルを記録しています",
  taskIcon: {
    name: "ic_launcher",
    type: "mipmap",
  },
  color: "#1E90FF",
  linkingURI: "soundlevelrecorder://",
};

export const startBackgroundTask = async (): Promise<void> => {
  await BackgroundService.start(backgroundTask, options);
};

export const stopBackgroundTask = async (): Promise<void> => {
  await BackgroundService.stop();
};
