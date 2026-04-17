import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';

const keys = [
  "ALCtEj+eHMEjBRLkQcM6/AJCFvekt08sUkui8a3R3AcT",
  "AJsfZD2rgf8kQxe5ZNqE8C/Mz02kJ/7yEKNd0/bLld2M",
  "APi5uQZqUNyjvY4tEo49mncxJXU2c/hDOKho/Bv+ZFJ2",
  "APDguuON/cP0Rmso/pRoKMFAbJPKFIEmXyXp9/GOXtGw"
];

for (const k of keys) {
  try {
    let secretKey;
    if (k.startsWith('suiprivkey')) {
        const decoded = decodeSuiPrivateKey(k);
        secretKey = decoded.secretKey;
    } else {
        // Base64 decoding (legacy format)
        const bytes = fromBase64(k);
        // byte[0] is flag (0 for Ed25519)
        if (bytes[0] === 0) {
            secretKey = bytes.slice(1);
        } else {
            console.log(`Key ${k} has non-Ed25519 flag: ${bytes[0]}`);
            continue;
        }
    }

    if (secretKey) {
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        console.log(`Key: ${k} -> Address: ${keypair.getPublicKey().toSuiAddress()}`);
    }
  } catch (e) {
    console.log(`Failed to decode ${k}: ${e.message}`);
  }
}
