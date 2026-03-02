import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import RecordingsScreen from "@/screens/RecordingsScreen";
import PlaybackScreen from "@/screens/PlaybackScreen";
import colors from "@/theme/colors";

export type RootStackParamList = {
  Home: undefined;
  Recordings: undefined;
  Playback: { uri: string; name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: colors.bgSecondary },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { color: colors.textPrimary },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: "Recording PoC" }}
        />
        <Stack.Screen
          name="Recordings"
          component={RecordingsScreen}
          options={{ title: "ファイル一覧" }}
        />
        <Stack.Screen
          name="Playback"
          component={PlaybackScreen}
          options={{ title: "再生" }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
