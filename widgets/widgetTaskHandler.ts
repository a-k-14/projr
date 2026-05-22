import {
  registerWidgetTaskHandler,
  registerWidgetConfigurationScreen,
  requestWidgetUpdate,
} from 'react-native-android-widget';
import { ReniWidgetConfigScreen } from './ReniWidgetConfigScreen';
import { renderReniWidget } from './ReniWidget';
import { renderReniQuickWidget } from './ReniQuickWidget';
import { fetchWidgetData } from './widgetDataService';
import { loadWidgetConfig, deleteWidgetConfig } from './widgetStorage';
import { DEFAULT_WIDGET_CONFIG } from './widgetTypes';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

registerWidgetConfigurationScreen(ReniWidgetConfigScreen);

async function widgetTaskHandler({
  widgetInfo,
  widgetAction,
  renderWidget,
}: WidgetTaskHandlerProps) {
  const { widgetId, widgetName } = widgetInfo;

  if (widgetAction === 'WIDGET_DELETED') {
    await deleteWidgetConfig(widgetId).catch(() => undefined);
    return;
  }

  if (widgetName === 'ReniQuickWidget') {
    renderWidget(renderReniQuickWidget(widgetInfo.width, widgetInfo.height));
    return;
  }

  const config = await loadWidgetConfig(widgetId).catch(() => ({ ...DEFAULT_WIDGET_CONFIG }));
  const data = await fetchWidgetData(config);
  renderWidget(renderReniWidget(data, config, widgetInfo.width));
}

registerWidgetTaskHandler(widgetTaskHandler);

export async function updateAllReniWidgets() {
  await Promise.all([
    requestWidgetUpdate({
      widgetName: 'ReniWidget',
      renderWidget: async (widgetInfo) => {
        const config = await loadWidgetConfig(widgetInfo.widgetId).catch(() => ({ ...DEFAULT_WIDGET_CONFIG }));
        const data = await fetchWidgetData(config);
        return renderReniWidget(data, config, widgetInfo.width);
      },
    }),
    requestWidgetUpdate({
      widgetName: 'ReniQuickWidget',
      renderWidget: async (widgetInfo) => {
        return renderReniQuickWidget(widgetInfo.width, widgetInfo.height);
      },
    }),
  ]).catch((err) => {
    console.warn('updateAllReniWidgets error:', err);
  });
}
