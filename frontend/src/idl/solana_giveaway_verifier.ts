/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/solana_giveaway_verifier.json`.
 */
export type SolanaGiveawayVerifier = {
  "address": "4jeVmPQfu7r4RvSoPRdR8AGfToAQk8DHPFz1LsnZuKPm",
  "metadata": {
    "name": "solanaGiveawayVerifier",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "cancelAndRefund",
      "discriminator": [
        86,
        34,
        75,
        82,
        239,
        186,
        2,
        228
      ],
      "accounts": [
        {
          "name": "giveaway",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  105,
                  118,
                  101,
                  97,
                  119,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "giveaway.giveawayId",
                "account": "giveaway"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "giveaway"
              }
            ]
          }
        },
        {
          "name": "organizer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createAndFund",
      "discriminator": [
        81,
        241,
        83,
        179,
        19,
        203,
        167,
        64
      ],
      "accounts": [
        {
          "name": "organizer",
          "writable": true,
          "signer": true
        },
        {
          "name": "giveaway",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  105,
                  118,
                  101,
                  97,
                  119,
                  97,
                  121
                ]
              },
              {
                "kind": "arg",
                "path": "giveawayId"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "giveaway"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "giveawayId",
          "type": "u64"
        },
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "prizeLamports",
          "type": "u64"
        },
        {
          "name": "endAt",
          "type": "i64"
        }
      ]
    },
    {
      "name": "declareWinner",
      "discriminator": [
        140,
        135,
        197,
        50,
        9,
        23,
        4,
        80
      ],
      "accounts": [
        {
          "name": "organizer",
          "signer": true,
          "relations": [
            "giveaway"
          ]
        },
        {
          "name": "giveaway",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  105,
                  118,
                  101,
                  97,
                  119,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "giveaway.giveawayId",
                "account": "giveaway"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "winner",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "payWinner",
      "discriminator": [
        95,
        54,
        215,
        39,
        87,
        139,
        215,
        225
      ],
      "accounts": [
        {
          "name": "giveaway",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  103,
                  105,
                  118,
                  101,
                  97,
                  119,
                  97,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "giveaway.giveawayId",
                "account": "giveaway"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "giveaway"
              }
            ]
          }
        },
        {
          "name": "winner",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "giveaway",
      "discriminator": [
        47,
        139,
        46,
        45,
        143,
        147,
        50,
        181
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidPrize",
      "msg": "Prize must be greater than zero"
    },
    {
      "code": 6001,
      "name": "invalidEndTime",
      "msg": "The end time must be in the future"
    },
    {
      "code": 6002,
      "name": "invalidTitle",
      "msg": "Title must not be empty and must fit within the byte limit"
    },
    {
      "code": 6003,
      "name": "timestampOverflow",
      "msg": "Refund deadline overflowed"
    },
    {
      "code": 6004,
      "name": "unauthorized",
      "msg": "Only the giveaway organizer may declare the winner"
    },
    {
      "code": 6005,
      "name": "invalidGiveawayStatus",
      "msg": "Giveaway must be funded before declaring a winner"
    },
    {
      "code": 6006,
      "name": "giveawayNotEnded",
      "msg": "The giveaway has not ended"
    },
    {
      "code": 6007,
      "name": "winnerDeclarationClosed",
      "msg": "The winner declaration window has closed"
    },
    {
      "code": 6008,
      "name": "invalidWinner",
      "msg": "Winner must not be the default public key"
    },
    {
      "code": 6009,
      "name": "invalidPaymentStatus",
      "msg": "Giveaway must have a declared winner before payment"
    },
    {
      "code": 6010,
      "name": "winnerAccountMismatch",
      "msg": "The provided winner account does not match the recorded winner"
    },
    {
      "code": 6011,
      "name": "invalidRefundStatus",
      "msg": "Giveaway must be funded to refund"
    },
    {
      "code": 6012,
      "name": "refundNotAvailable",
      "msg": "The refund deadline has not been reached"
    },
    {
      "code": 6013,
      "name": "refundOrganizerMismatch",
      "msg": "The refund destination must be the recorded organizer"
    }
  ],
  "types": [
    {
      "name": "giveaway",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "organizer",
            "type": "pubkey"
          },
          {
            "name": "giveawayId",
            "type": "u64"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "prizeLamports",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "endAt",
            "type": "i64"
          },
          {
            "name": "refundAfter",
            "type": "i64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "giveawayStatus"
              }
            }
          },
          {
            "name": "winner",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "paidLamports",
            "type": "u64"
          },
          {
            "name": "giveawayBump",
            "type": "u8"
          },
          {
            "name": "vaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "giveawayStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "funded"
          },
          {
            "name": "winnerDeclared"
          },
          {
            "name": "paid"
          },
          {
            "name": "refunded"
          }
        ]
      }
    }
  ],
  "constants": [
    {
      "name": "giveawaySeed",
      "type": "bytes",
      "value": "[103, 105, 118, 101, 97, 119, 97, 121]"
    },
    {
      "name": "vaultSeed",
      "type": "bytes",
      "value": "[118, 97, 117, 108, 116]"
    }
  ]
};
