import PWCore, {
    Address,
    AddressType,
    ChainID,
    Config,
    IndexerCollector,
    Cell,
    RPC,
    BuilderOption,
    OutPoint,
    CellDep,
    DepType,
    Builder,
    EthProvider
} from '@lay2/pw-core';
import UP from 'up-core-test';
import UPCKB from 'up-ckb-alpha-test';

import { CONFIG } from './nft/config';
import { TransactionBuilderExpectedMNFTData } from './nft/nft';
import { TransferNFTBuilder } from './nft/TransferNFTBuilder';
import BasicCollector from './nft/BasicCollector';

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

    public myAddress: string;

    public myBalance: string;

    private _collector: IndexerCollector;

    private _pwCore: PWCore;

    private _provider: EthProvider;

    constructor() {
        this._pwCore = new PWCore(CONFIG.CKB_NODE_RPC_URL);
    }

    public async init({
        pwCore,
        pwConfig,
        pwChainId = ChainID.ckb_testnet
    }: {
        pwCore?: PWCore;
        pwConfig?: Config;
        pwChainId?: ChainID;
    }) {
        this._provider = new EthProvider();
        this._collector = new IndexerCollector(CONFIG.CKB_INDEXER_RPC_URL);
        await this._pwCore?.init(this._provider, this._collector);

        if (pwCore) {
            UP.config({
                domain: process.env.UNIPASS_URL
            });
            this._pwCore = pwCore;
            PWCore.setChainId(pwChainId, pwConfig);
            UPCKB.config({
                upSnapshotUrl: `${process.env.AGGREGATOR_URL}/snapshot/`,
                chainID: Number(process.env.PW_CORE_CHAIN_ID),
                ckbIndexerUrl: process.env.CKB_INDEXER_URL,
                ckbNodeUrl: process.env.CKB_NODE_URL,
                upLockCodeHash: process.env.ASSET_LOCK_CODE_HASH as string
            });
        }
    }

    async bridgeMNFTS(
        toLayerOneAddress: string,
        nfts: TransactionBuilderExpectedMNFTData[],
        receiverLayerTwoEthereumAddress: string
    ): Promise<string> {
        const outpoints = getOutPoint(nfts);
        console.log(toLayerOneAddress, outpoints);

        const provider = this._provider;
        const fromAddress = provider.address;
        const toAddress = new Address(toLayerOneAddress, AddressType.ckb);

        console.log('[getNFTTransferSignMessage-fromAddress]', fromAddress);
        console.log('[getNFTTransferSignMessage-toAddress]', toAddress);

        const rpc = new RPC(CONFIG.CKB_NODE_RPC_URL);
        const cells = await Promise.all(outpoints.map(x => Cell.loadFromBlockchain(rpc, x)));
        console.log('[cells]', cells);

        const builderOption: BuilderOption = {
            witnessArgs: Builder.WITNESS_ARGS.Secp256k1,
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

        const txId = await this._pwCore.sendTransaction(transaction);
        console.log(`Transaction submitted: ${txId}`);

        return txId;
    }

    async connect() {
        console.log('connect clicked');
        try {
            const account = await UP.connect({ email: false, evmKeys: true });
            this.username = account.username;
            console.log('account', account);
            const address: Address = UPCKB.getCKBAddress(this.username);
            this.myAddress = address.toCKBAddress();
            const indexerCollector = new IndexerCollector(process.env.CKB_INDEXER_URL as string);
            const balance = await indexerCollector.getBalance(address as Address);
            console.log('balance', balance);
            this.myBalance = balance.toString();
        } catch (err) {
            // this.$message.error(err as string);
            console.log('connect err', err);
        }
    }
}
