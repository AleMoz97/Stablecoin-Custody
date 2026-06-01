import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { createRequire } from "node:module";
import type { Prisma } from "../prisma/generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

const require = createRequire(import.meta.url);

const StablecoinArtifact = require("../abi/Stablecoin.json");
const MultisigArtifact = require("../abi/Multisig_1.json");

const stablecoinAbi = StablecoinArtifact.abi ?? StablecoinArtifact;
const multisigAbi = MultisigArtifact.abi ?? MultisigArtifact;

@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
    private wsProvider!: ethers.WebSocketProvider;

    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) { }

    async onModuleInit() {
        this.wsProvider = new ethers.WebSocketProvider(
            this.config.getOrThrow<string>("RPC_WS_URL"),
        );

        this.listenToContract(
            this.config.getOrThrow<string>("STABLECOIN_ADDRESS"),
            new ethers.Interface(stablecoinAbi),
        );

        this.listenToContract(
            this.config.getOrThrow<string>("MINT_BURN_MULTISIG_ADDRESS"),
            new ethers.Interface(multisigAbi),
        );

        this.listenToContract(
            this.config.getOrThrow<string>("ADMIN_MULTISIG_ADDRESS"),
            new ethers.Interface(multisigAbi),
        );

        console.log("WebSocket on-chain event listener started");
    }

    // quando chiudo l'app chiudi la connessione
    async onModuleDestroy() {
        if (this.wsProvider) {
            await this.wsProvider.destroy();
        }
    }

    // funzione che permette di ricevere gli eventi on-chain e salvarli su db
    // struttura base per ogni contratto (multisig e stablecoin)
    private listenToContract(address: string, iface: ethers.Interface) {
        this.wsProvider.on({ address }, async (log) => {
            try {
                const parsed = iface.parseLog({
                    topics: log.topics,
                    data: log.data,
                });

                if (!parsed) {
                    return;
                }

                const payload = this.buildPayload(parsed) as Prisma.InputJsonValue;

                await this.prisma.chainEvent.upsert({
                    where: {
                        txHash_logIndex: {
                            txHash: log.transactionHash,
                            logIndex: Number(log.index),
                        },
                    },
                    update: {},
                    create: {
                        contractAddress: log.address,
                        eventName: parsed.name,
                        txHash: log.transactionHash,
                        blockNumber: BigInt(log.blockNumber),
                        logIndex: Number(log.index),
                        payload,
                    },
                });
            } catch (error) {
                console.error("Failed to persist event", error);
            }
        });
    }

    // permette di creare un JSON associato a un evento on-chain con i relativi parametri
    private buildPayload(parsed: ethers.LogDescription) {
        const payload: Record<string, unknown> = {};

        parsed.fragment.inputs.forEach((input, index) => {
            const name = input.name || `arg${index}`;
            const value = parsed.args[index];

            payload[name] = this.normalizeValue(value);
        });

        return payload;
    }

    private normalizeValue(value: unknown): unknown {
        if (typeof value === "bigint") {
            return value.toString();
        }

        if (Array.isArray(value)) {
            return value.map((item) => this.normalizeValue(item));
        }

        return value;
    }
}
