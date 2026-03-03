import { TouchableOpacity, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import RecordingsScreen from "@/screens/RecordingsScreen";
import PlaybackScreen from "@/screens/PlaybackScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import colors from "@/theme/colors";

export type RootStackParamList = {
  Home: undefined;
  Recordings: undefined;
  Playback: { uri: string; name: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const App = () => {
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
          options={({ navigation }) => ({
            title: "Sound Level Recorder",
            headerRight: () => (
              <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
                <Text style={{ color: colors.textPrimary, fontSize: 22 }}>⚙</Text>
              </TouchableOpacity>
            ),
          })}
        />
        <Stack.Screen
          name="Recordings"
          component={RecordingsScreen}
          options={{ title: "ファイル一覧" }}
        />
        <Stack.Screen name="Playback" component={PlaybackScreen} options={{ title: "再生" }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "設定" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default App;
