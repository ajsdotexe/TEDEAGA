import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Share } from '@capacitor/share';
import * as XLSX from 'xlsx';

const SecureStore = registerPlugin('SecureStore');
const GoogleDriveAuth = registerPlugin('GoogleDriveAuth');
const AndroidWidget = registerPlugin('AndroidWidget');
window.TEDEAGANative = { Capacitor, CapacitorHttp, Filesystem, Directory, Encoding, LocalNotifications, Share, SecureStore, GoogleDriveAuth, AndroidWidget };
window.XLSX = XLSX;
window.__TEDEAGA_ANDROID__ = Capacitor.isNativePlatform();
