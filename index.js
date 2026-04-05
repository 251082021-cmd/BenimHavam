import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './widget-task-handler';
import App from './App';

registerWidgetTaskHandler(widgetTaskHandler);
registerRootComponent(App);