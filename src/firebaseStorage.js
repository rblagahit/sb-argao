import { getStorage } from 'firebase/storage';
import { app } from './firebase';

// Shelved local-file upload feature uses this entry point.
// Keeping it separate keeps Storage out of the default runtime until re-enabled.
export const storage = getStorage(app);
