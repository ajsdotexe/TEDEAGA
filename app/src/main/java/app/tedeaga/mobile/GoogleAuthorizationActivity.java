package app.tedeaga.mobile;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;

public class GoogleAuthorizationActivity extends Activity {
    static final String EXTRA_PENDING_INTENT = "google_pending_intent";
    private static final int REQUEST_AUTH = 17421;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        PendingIntent pending;
        if (Build.VERSION.SDK_INT >= 33) {
            pending = getIntent().getParcelableExtra(EXTRA_PENDING_INTENT, PendingIntent.class);
        } else {
            pending = getIntent().getParcelableExtra(EXTRA_PENDING_INTENT);
        }
        if (pending == null) {
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }
        try {
            startIntentSenderForResult(pending.getIntentSender(), REQUEST_AUTH, null, 0, 0, 0);
        } catch (Exception error) {
            setResult(Activity.RESULT_CANCELED);
            finish();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_AUTH) return;
        setResult(resultCode, data);
        finish();
    }
}
