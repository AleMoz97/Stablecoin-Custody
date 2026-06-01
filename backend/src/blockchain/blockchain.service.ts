import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    InternalServerErrorException,
    NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { createRequire } from "node:module";
import { MultisigKind, OperationType } from "../prisma/generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { BalanceResponseDto } from "../stablecoin/dto/balance-response.dto.js";
import type { BurnRequestDto } from "../stablecoin/dto/burn-request.dto.js";
import type { FreezeRequestDto } from "../stablecoin/dto/freeze-request.dto.js";
import type { MintRequestDto } from "../stablecoin/dto/mint-request.dto.js";
import type { OperationSummaryResponseDto } from "../stablecoin/dto/operation-summary-response.dto.js";
import type { TransactionStatusResponseDto } from "../stablecoin/dto/transaction-status-response.dto.js";

const require = createRequire(import.meta.url);

const StablecoinArtifact = require("../abi/Stablecoin.json");
const MultisigArtifact = require("../abi/Multisig_1.json");

const stablecoinAbi = StablecoinArtifact.abi ?? StablecoinArtifact;
const multisigAbi = MultisigArtifact.abi ?? MultisigArtifact; // ne uso solo una di abi perchè per i due multisig non cambia nulla, sono identici

type SignerGroup = "mintBurn" | "admin";
type ApiTxMappingRecord = {
    id: string;
    operationType: OperationType;
    multisigKind: MultisigKind;
    multisigTxId: bigint;
    createdAt: Date;
};

@Injectable()
export class BlockchainService {
    private readonly provider: ethers.JsonRpcProvider;

    private readonly stablecoinAddress: string;
    private readonly mintBurnMultisigAddress: string;
    private readonly adminMultisigAddress: string;

    private readonly stablecoinInterface = new ethers.Interface(stablecoinAbi);

    private readonly stablecoin: ethers.Contract;
    private readonly mintBurnMultisig: ethers.Contract;
    private readonly adminMultisig: ethers.Contract;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.provider = new ethers.JsonRpcProvider(
            this.config.getOrThrow<string>("RPC_HTTP_URL"),
        );

        this.stablecoinAddress =
            this.config.getOrThrow<string>("STABLECOIN_ADDRESS");

        this.mintBurnMultisigAddress = this.config.getOrThrow<string>(
            "MINT_BURN_MULTISIG_ADDRESS",
        );

        this.adminMultisigAddress = this.config.getOrThrow<string>(
            "ADMIN_MULTISIG_ADDRESS",
        );

        this.stablecoin = new ethers.Contract(
            this.stablecoinAddress,
            stablecoinAbi,
            this.provider,
        );

        this.mintBurnMultisig = new ethers.Contract(
            this.mintBurnMultisigAddress,
            multisigAbi,
            this.provider,
        );

        this.adminMultisig = new ethers.Contract(
            this.adminMultisigAddress,
            multisigAbi,
            this.provider,
        );
    }

    async handleMintRequest(input: MintRequestDto): Promise<OperationSummaryResponseDto> {

        // qua vuol dire che sta cercando di fare una conferma a una transazione già esistente
        if (input.txId) {
            return this.confirmExistingOperation(
                input.txId,
                input.signer,
                OperationType.MINT,
            );
        }

        // da qua sono tutte transazioni "nuove" e non di conferma di altre già esistenti
        if (!input.kycPassed) {
            throw new ForbiddenException("KYC check failed.");
        }

        if (!input.to || !input.amount) {
            throw new BadRequestException("Missing to or amount.");
        }

        // tolgo il numero con la virgola fino a 6 decimali. In pratica amount * 10^6
        const amountUnits = this.parseTokenAmount(input.amount);

        const calldata = this.stablecoinInterface.encodeFunctionData("mint", [
            input.to,
            amountUnits,
        ]);

        return this.submitOperation({
            operationType: OperationType.MINT,
            multisigKind: MultisigKind.MINT_BURN,
            signerGroup: "mintBurn",
            signer: input.signer,
            multisigAddress: this.mintBurnMultisigAddress,
            multisigAbi: multisigAbi,
            calldata,
        });
    }

    async handleBurnRequest(input: BurnRequestDto): Promise<OperationSummaryResponseDto> {
        if (input.txId) {
            return this.confirmExistingOperation(
                input.txId,
                input.signer,
                OperationType.BURN,
            );
        }

        if (!input.from || !input.amount) {
            throw new BadRequestException("Missing from or amount.");
        }

        const amountUnits = this.parseTokenAmount(input.amount);

        const calldata = this.stablecoinInterface.encodeFunctionData("burn", [
            input.from,
            amountUnits,
        ]);

        return this.submitOperation({
            operationType: OperationType.BURN,
            multisigKind: MultisigKind.MINT_BURN,
            signerGroup: "mintBurn",
            signer: input.signer,
            multisigAddress: this.mintBurnMultisigAddress,
            multisigAbi: multisigAbi,
            calldata,
        });
    }

    async handleFreezeRequest(input: FreezeRequestDto): Promise<OperationSummaryResponseDto> {
        if (input.txId) {
            return this.confirmExistingOperation(
                input.txId,
                input.signer,
                OperationType.FREEZE,
            );
        }

        if (!input.account) {
            throw new BadRequestException("Missing account.");
        }

        const calldata = this.stablecoinInterface.encodeFunctionData("freeze", [
            input.account,
        ]);

        return this.submitOperation({
            operationType: OperationType.FREEZE,
            multisigKind: MultisigKind.ADMIN,
            signerGroup: "admin",
            signer: input.signer,
            multisigAddress: this.adminMultisigAddress,
            multisigAbi: multisigAbi,
            calldata,
        });
    }

    private async submitOperation(input: {
        operationType: OperationType;
        multisigKind: MultisigKind;
        signerGroup: SignerGroup;
        signer: string;
        multisigAddress: string;
        multisigAbi: any[];
        calldata: string;
    }): Promise<OperationSummaryResponseDto> {
        // prendo il wallet del signer che mi arriva in input. Leggo variabili d'ambiente
        const signerWallet = this.getSigner(input.signer, input.signerGroup);

        const multisig = new ethers.Contract(
            input.multisigAddress,
            input.multisigAbi,
            signerWallet,
        );

        // mando la transazione al multisig
        const tx = await multisig.submitTransaction(
            this.stablecoinAddress,
            input.calldata,
        );

        const receipt = await tx.wait();

        const multisigTxId = this.extractSubmittedTxId(
            receipt, // ricevuta della transazione appena mandata
            new ethers.Interface(input.multisigAbi), // interfaccia del contratto sui cui ho eseguito la transazione
        );

        // scrivo in db la txId del multisig associata a un id univoco che mi permette di distingerla
        // a livello globale con quella dell'altro multisig
        const mapping = await this.prisma.apiTxMapping.create({
            data: {
                operationType: input.operationType,
                multisigKind: input.multisigKind,
                multisigTxId: BigInt(multisigTxId.toString()),
            },
        });

        return this.getOperationSummary(mapping);
    }

    // va a verificare che una transazione che si vuole confermare esista veramente
    private async confirmExistingOperation(
        apiTxId: string,
        signer: string,
        expectedType: OperationType,
    ): Promise<OperationSummaryResponseDto> {
        // query al db
        const mapping = await this.prisma.apiTxMapping.findUnique({
            where: { id: apiTxId },
        });

        if (!mapping) {
            throw new NotFoundException("Transaction not found.");
        }

        // se le due operazioni non coincidono allora errore
        // la conferma deve essere sullo stesso tipo "MINT" con "MINT" ad esempio
        if (mapping.operationType !== expectedType) {
            throw new BadRequestException(
                `Invalid endpoint for transaction type ${mapping.operationType}`,
            );
        }

        // connessione al multisig con key privata del signer effettivo
        const { multisig } = this.getMultisigContractForWrite(
            mapping.multisigKind,
            signer,
        );

        // address target, uint256 value, bytes memory data, bool executed, uint256 confirmations
        const current = await multisig.getTransaction(mapping.multisigTxId);

        // se è già stata eseguita non servono ulteriori conferme e quindi ti do indietro le informazioni sul fatto che è stata eseguita
        if (current.executed) {
            return this.getOperationSummary(mapping);
        }

        const tx = await multisig.confirmTransaction(mapping.multisigTxId);
        await tx.wait();

        return this.getOperationSummary(mapping);
    }

    async getStatus(apiTxId: string): Promise<TransactionStatusResponseDto> {
        const mapping = await this.prisma.apiTxMapping.findUnique({
            where: { id: apiTxId },
        });

        if (!mapping) {
            throw new NotFoundException("Transaction not found.");
        }

        const multisig = this.getMultisigContractForRead(mapping.multisigKind);

        const txData = await multisig.getTransaction(mapping.multisigTxId);

        const decodedCall = this.decodeStablecoinCall(txData.data);

        return {
            txId: mapping.id,
            operationType: mapping.operationType,
            multisigTxId: mapping.multisigTxId.toString(),
            status: txData.executed ? "EXECUTED" : "PENDING_CONFIRMATIONS",
            confirmations: Number(txData.confirmations),
            createdAt: mapping.createdAt,
            ...(decodedCall ?? {}),
        };
    }

    async getBalance(address: string): Promise<BalanceResponseDto> {
        if (!ethers.isAddress(address)) {
            throw new BadRequestException("Invalid address.");
        }

        const balance = await this.stablecoin.balanceOf(address);

        return {
            address,
            balance: ethers.formatUnits(balance, 6),
            rawBalance: balance.toString(),
            decimals: 6,
        };
    }

    private getMultisigContractForRead(kind: MultisigKind) {
        if (kind === MultisigKind.MINT_BURN) {
            return this.mintBurnMultisig;
        }

        return this.adminMultisig;
    }

    private getMultisigContractForWrite(kind: MultisigKind, signer: string) {
        // qua nel caso in cui si voglia confermare una transazione di mint o burn
        if (kind === MultisigKind.MINT_BURN) {
            const wallet = this.getSigner(signer, "mintBurn");

            return {
                signerGroup: "mintBurn" as const,
                multisig: new ethers.Contract(
                    this.mintBurnMultisigAddress,
                    multisigAbi,
                    wallet,
                ),
            };
        }

        const wallet = this.getSigner(signer, "admin");

        return {
            signerGroup: "admin" as const,
            multisig: new ethers.Contract(
                this.adminMultisigAddress,
                multisigAbi,
                wallet,
            ),
        };
    }

    private async getOperationSummary(
        mapping: ApiTxMappingRecord,
    ): Promise<OperationSummaryResponseDto> {
        // prendo il multisig in sola lettura senza necessità di chiave perchè devo solo leggere uno stato
        const multisig = this.getMultisigContractForRead(mapping.multisigKind);
        const txData = await multisig.getTransaction(mapping.multisigTxId);

        return {
            txId: mapping.id,
            status: txData.executed ? "EXECUTED" : "PENDING_CONFIRMATIONS",
            createdAt: mapping.createdAt,
        };
    }

    // restituisce il wallet direttamente in ethers.js connesso al provider, pronto per firmare e inviare transazioni
    private getSigner(label: string, group: SignerGroup) {
        const normalized = label.toLowerCase();

        // qua le carichiamo tutte in modo da poter poi prendere solo dopo quella che ci interessa davvero che è associata al signer che arriva in input
        const mintBurnKeys: Record<string, string> = {
            owner1: this.config.getOrThrow<string>("OWNER1_PRIVATE_KEY"),
            owner2: this.config.getOrThrow<string>("OWNER2_PRIVATE_KEY"),
            owner3: this.config.getOrThrow<string>("OWNER3_PRIVATE_KEY"),
        };

        const adminKeys: Record<string, string> = {
            admin1: this.config.getOrThrow<string>("ADMIN1_PRIVATE_KEY"),
            admin2: this.config.getOrThrow<string>("ADMIN2_PRIVATE_KEY"),
            admin3: this.config.getOrThrow<string>("ADMIN3_PRIVATE_KEY"),
        };

        const privateKey =
            group === "mintBurn"
                ? mintBurnKeys[normalized]
                : adminKeys[normalized];

        if (!privateKey) {
            throw new BadRequestException(`Invalid signer ${label} for ${group}.`);
        }

        return new ethers.Wallet(privateKey, this.provider);
    }

    private extractSubmittedTxId(
        receipt: ethers.TransactionReceipt,
        iface: ethers.Interface,
    ) {
        // guarda tutti gli eventi che sono associati alla receipt in input per trovare quello associato a TransactionSubmitted
        // serve per confermare che effettivamente la transazione sia stata eseguita sul multisig
        for (const log of receipt.logs) {
            try {
                const parsed = iface.parseLog({
                    topics: log.topics,
                    data: log.data,
                });

                if (parsed?.name === "TransactionSubmitted") {
                    return parsed.args.txId; // in args ho i parametri che vengono esposti dall'evento specfico
                }
            } catch {
                continue;
            }
        }

        throw new InternalServerErrorException("TransactionSubmitted event not found.");
    }

    private parseTokenAmount(amount: string) {
        try {
            return ethers.parseUnits(amount, 6);
        } catch {
            throw new BadRequestException(
                "Invalid amount. Use a decimal string with up to 6 decimals.",
            );
        }
    }

    // questa funzione mi serve per andare a vedere i parametri effettivi all'interno di una certa funzione del contratto stablecoin
    private decodeStablecoinCall(data: string) {
        try {
            const parsed = this.stablecoinInterface.parseTransaction({ data });

            if (!parsed) {
                return null;
            }

            if (parsed.name === "mint") {
                return {
                    function: "mint",
                    address: parsed.args[0],
                    amount: ethers.formatUnits(parsed.args[1], 6),
                };
            }

            if (parsed.name === "burn") {
                return {
                    function: "burn",
                    address: parsed.args[0],
                    amount: ethers.formatUnits(parsed.args[1], 6),
                };
            }

            if (parsed.name === "freeze") {
                return {
                    function: "freeze",
                    address: parsed.args[0],
                };
            }

            return null;
        } catch {
            return null;
        }
    }
}
