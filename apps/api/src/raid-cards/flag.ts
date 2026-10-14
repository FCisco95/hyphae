// Read at call time: the bot commands' tests never load env.ts (they mock the database), and tests
// switch it with vi.stubEnv. env.ts validates the value at boot.
export const raidCardsOn = () => process.env.RAID_CARDS === "on";
