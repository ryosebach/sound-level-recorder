import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import RecordingsScreen from "@/screens/RecordingsScreen";

export type RootStackParamList = {
  Home: undefined;
  Recordings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
