/* eslint-disable no-param-reassign */
import PWCore, {
    Address,
    AddressType,
    IndexerCollector,
    Cell,
    RPC,
    BuilderOption,
    OutPoint,
    CellDep,
    DepType,
    Builder,
    DefaultSigner,
    Transaction,
    Reader,
    transformers
} from '@lay2/pw-core';
import UP from 'up-core-test';
import UPCKB, {
    AssetLockProof,
    completeTxWithProof,
    fetchAssetLockProof,
    UPCKBBaseProvider
} from 'up-ckb-alpha-test';

import { CONFIG } from './nft/config';
import { TransactionBuilderExpectedMNFTData } from './nft/nft';
import { TransferNFTBuilder } from './nft/TransferNFTBuilder';
import BasicCollector from './nft/BasicCollector';
import { UPCoreSimpleProvider } from './UpCoreSimpleProvider';

const AggronCellDeps = [
    new CellDep(
        DepType.code,
        new OutPoint('0x04a1ac7fe15e454741d3c5c9a409efb9a967714ad2f530870514417978a9f655', '0x0')
    ),
    new CellDep(
        DepType.code,
        new OutPoint('0x65080f85a9c270c1208cc8648f8d73dfb630bab659699f56fb27cff9039c5820', '0x0')
    ),
    new CellDep(
        DepType.code,
        new OutPoint('0xd346695aa3293a84e9f985448668e9692892c959e7e83d6d8042e59c08b8cf5c', '0x0')
    ),
    new CellDep(
        DepType.code,
        new OutPoint('0xf11ccb6079c1a4b3d86abe2c574c5db8d2fd3505fdc1d5970b69b31864a4bd1c', '0x2')
    )
];

export function getOutPoint(nfts: TransactionBuilderExpectedMNFTData[]): OutPoint[] {
    const outpoints: OutPoint[] = [];
    for (const item of nfts) {
        const outPoint = new OutPoint(item.outPoint.txHash, item.outPoint.index);
        outpoints.push(outPoint);
    }
    return outpoints;
}

export class UnipassV3Wrapper {
    public username: string;

    public layerOneAddress: Address;

    public myBalance: string;

    private _collector: IndexerCollector;

    public async init() {
        this._collector = new IndexerCollector(CONFIG.CKB_INDEXER_RPC_URL);

        UP.config({
            domain: CONFIG.UNIPASS_URL
        });

        PWCore.setChainId(CONFIG.PW_CORE_CHAIN_ID);

        UPCKB.config({
            upSnapshotUrl: `${CONFIG.UNIPASS_AGGREGATOR_URL}/snapshot/`,
            chainID: CONFIG.PW_CORE_CHAIN_ID,
            ckbIndexerUrl: CONFIG.CKB_INDEXER_RPC_URL,
            ckbNodeUrl: CONFIG.CKB_NODE_RPC_URL,
            upLockCodeHash: CONFIG.UNIPASS_ASSET_LOCK_CODE_HASH
        });
    }

    async bridgeMNFTS(
        toLayerOneAddress: string,
        nfts: TransactionBuilderExpectedMNFTData[],
        receiverLayerTwoEthereumAddress: string
    ): Promise<string> {
        const outpoints = getOutPoint(nfts);
        console.log(toLayerOneAddress, outpoints);

        const provider = new UPCoreSimpleProvider(
            this.username,
            CONFIG.UNIPASS_ASSET_LOCK_CODE_HASH
        );
        const fromAddress = provider.address;
        const toAddress = new Address(toLayerOneAddress, AddressType.ckb);

        console.log('[getNFTTransferSignMessage-fromAddress]', fromAddress);
        console.log('[getNFTTransferSignMessage-toAddress]', toAddress);

        const rpc = new RPC(CONFIG.CKB_NODE_RPC_URL);
        const cells = await Promise.all(outpoints.map(x => Cell.loadFromBlockchain(rpc, x)));
        console.log('[cells]', cells);

        const builderOption: BuilderOption = {
            witnessArgs: Builder.WITNESS_ARGS.RawSecp256k1,
            collector: this._collector
        };
        const cellDeps = AggronCellDeps;
        const builder = new TransferNFTBuilder(
            toAddress,
            cells,
            builderOption,
            cellDeps,
            new BasicCollector(CONFIG.CKB_INDEXER_RPC_URL),
            receiverLayerTwoEthereumAddress
        );
        const transaction = await builder.build();

        const txId = await this.sendTransaction(transaction, provider);
        console.log(`Transaction submitted: ${txId}`);

        return txId;
    }

    async connect() {
        const account = await UP.connect({ email: false, evmKeys: true });
        this.username = account.username;
        console.log('account', account);
        this.layerOneAddress = UPCKB.getCKBAddress(this.username);
        const indexerCollector = new IndexerCollector(CONFIG.CKB_INDEXER_RPC_URL);
        const balance = await indexerCollector.getBalance(this.layerOneAddress);
        console.log('balance', balance);
        this.myBalance = balance.toString();
    }

    private async sendTransaction(tx: Transaction, provider: UPCKBBaseProvider): Promise<string> {
        // save old cell deps and restore old cell deps after complete tx
        const oldCellDeps = tx.raw.cellDeps;
        tx.raw.cellDeps = [];
        const signer = new DefaultSigner(provider);
        const signedTx = await signer.sign(tx);

        const rpc = new RPC(CONFIG.CKB_NODE_RPC_URL);
        return this.sendUPLockTransaction(provider.usernameHash, signedTx, rpc, oldCellDeps);
    }

    private async sendUPLockTransaction(
        usernameHash: string,
        signedTx: Transaction,
        rpc: RPC,
        oldCellDeps: CellDep[]
    ) {
        // fetch cellDeps/userinfo/proof from aggregator
        const assetLockProof: AssetLockProof = await fetchAssetLockProof(usernameHash);
        if (new Reader(assetLockProof.lockInfo[0].userInfo).length() === 0) {
            throw new Error('user not registered');
        }

        // fill tx cell deps and witness
        (assetLockProof as any).cellDeps = [...assetLockProof.cellDeps, ...oldCellDeps];
        const completedSignedTx = completeTxWithProof(signedTx, assetLockProof, usernameHash);

        const transformedTx = transformers.TransformTransaction(completedSignedTx);
        const txHash = await rpc.send_transaction(transformedTx, 'passthrough');
        return txHash;
    }
}
