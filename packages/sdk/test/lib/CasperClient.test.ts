import { expect } from 'chai';
import { CasperClient } from '../../src/lib/CasperClient';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DeployUtil, Keys, PublicKey } from '../../src/lib';
import { Ed25519, SignatureAlgorithm } from '../../src/lib/Keys';
import JSBI from 'jsbi';

let casperClient: CasperClient;
describe('CasperClient', () => {
  before(() => {
    casperClient = new CasperClient(
      'http://192.168.2.166:40101/rpc',
      'http://mock2:7777'
    );
  });

  it('should generate new Ed25519 key pair, and compute public key from private key', () => {
    const edKeyPair = casperClient.newKeyPair();
    const publicKey = edKeyPair.publicKey.rawPublicKey;
    const privateKey = edKeyPair.privateKey;
    const convertFromPrivateKey = casperClient.privateToPublicKey(
      privateKey,
      SignatureAlgorithm.Ed25519
    );
    expect(convertFromPrivateKey).to.deep.equal(publicKey);
  });

  it('should generate PEM file for Ed25519 correctly', () => {
    const edKeyPair = casperClient.newKeyPair();
    const publicKeyInPem = edKeyPair.exportPublicKeyInPem();
    const privateKeyInPem = edKeyPair.exportPrivateKeyInPem();

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
    fs.writeFileSync(tempDir + '/public.pem', publicKeyInPem);
    fs.writeFileSync(tempDir + '/private.pem', privateKeyInPem);
    const publicKeyFromFIle = casperClient.loadPublicKeyFromFile(
      tempDir + '/public.pem',
      SignatureAlgorithm.Ed25519
    );
    const privateKeyFromFile = casperClient.loadPrivateKeyFromFile(
      tempDir + '/private.pem',
      SignatureAlgorithm.Ed25519
    );

    const keyPairFromFile = Keys.Ed25519.parseKeyPair(
      publicKeyFromFIle,
      privateKeyFromFile
    );

    expect(keyPairFromFile.publicKey.rawPublicKey).to.deep.equal(
      edKeyPair.publicKey.rawPublicKey
    );
    expect(keyPairFromFile.privateKey).to.deep.equal(edKeyPair.privateKey);
  });

  // todo move it to example once we publish transfer feature
  describe.skip('transfer', async () => {
    const transfer = new DeployUtil.Transfer(
      100000000000000,
      PublicKey.fromHex(
        '01a72eb5ba13e243d40e56b0547536e3ad1584eee5a386c7be5d5a1f94c09a6592'
      )
    );
    const keyPair = Ed25519.parseKeyFiles(
      '../server/test.public.key',
      '../server/test.private.key'
    );
    const deploy = casperClient.makeTransferDeploy(
      new DeployUtil.DeployParams(keyPair.publicKey, 'casper-net-1'),
      transfer,
      DeployUtil.standardPayment(JSBI.BigInt(100000000000000))
    );
    const signedDeploy = casperClient.signDeploy(deploy, keyPair);
    const deployHash = await casperClient.putDeploy(signedDeploy);
    console.log(deployHash);
  });
});
