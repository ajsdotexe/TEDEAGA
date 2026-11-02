package app.tedeaga.mobile;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(SecureStorePlugin.class);
        registerPlugin(GoogleDriveAuthPlugin.class);
        registerPlugin(AndroidWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
