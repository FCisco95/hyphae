# Program evidence

## Mainnet deployment

Program [EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E](https://explorer.solana.com/address/EAz8WkyUbGqr3ewSLpk94GWEoiWsvMENE5zV7Tvh4d6E) was deployed on October 2, 2026. [Deployment transaction](https://solscan.io/tx/5B2are5dPJqDvirkFH5CGLdPSzcvkaBeA6jEkTjq68HfHo5sNgt4SksG646wDXAcMx3f4Xw1pLAJATM7oWUDVJJ), finalized slot 452597368.

ProgramData: [CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J](https://explorer.solana.com/address/CHm2qHs1Mj3FF4pmRdwmtEYBrL2WkupesoayiwxiNp3J). At deployment the sole upgrade authority read back as Ledger public key [2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR](https://explorer.solana.com/address/2kz1Zq8UDm9Hq6XwPW6cViQZe7aySEBGk1gLWN8gofjR).

## Verifiable build

The recorded 229,432-byte binary has SHA-256 cb4ffdd8074442310f7953b5233a4c2df4eaf8c3f7627cdf259efb84ebf98d79. Its solana-verify executable hash is:

`7e902d1b5f8d8c49dfd199ec2e7bf44139b56524d98408f1556e14f4e9ab43ac`

Two recorded clean builds matched this executable hash. The October 11 mainnet solana-verify read matched it again; this was a readback, not a new build or deployment. [Commands, pinned build image and full hashes](https://github.com/FCisco95/hyphae-program#verify-the-build); [October 11 readback](2026-10-10-mainnet-payout.md#program-hash-re-read-october-11).

The on-chain verification record that lets explorers show the program as verified has not been published. Reproducible binary equality and an explorer verification badge are separate claims.

## Custody and fee

The publisher chooses the payout root. The program verifies a signed wallet's leaf and proof; it cannot decide whether the chosen list is fair. The upgrade authority can replace the program. [Pilot custody policy](https://github.com/FCisco95/hyphae-program#custody-during-the-pilot); [source](https://github.com/FCisco95/hyphae-program/tree/main/programs/hyphae).

MYCEL's community and vault were created on mainnet on October 10. The 3% fee recipient was fixed at creation: Squads vault [rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK](https://explorer.solana.com/address/rRceAUBNsnZKJDytjdHfCdqgTJGoDagtKujfvaBu7MK), requiring 2 of 3 signers. [Creation, fee and claim receipts](2026-10-10-mainnet-payout.md).

The temporary deployment keys were deleted after their recorded recovery checks. This is a historical operator attestation, not something a chain read can prove. No key files, recovery material or device/storage instructions are published here.
