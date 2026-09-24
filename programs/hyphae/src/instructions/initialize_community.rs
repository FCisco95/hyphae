use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::HyphaeError;
use crate::state::{Community, Vault};

#[derive(Accounts)]
pub struct InitializeCommunity<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK: only its address is used, as a seed; the constraint checks it is a token mint's
    /// account, so a wallet address cannot be registered by mistake.
    #[account(
        constraint = *mint.owner == TOKEN_PROGRAM_ID || *mint.owner == TOKEN_2022_PROGRAM_ID
            @ HyphaeError::NotAMint
    )]
    pub mint: UncheckedAccount<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + Community::INIT_SPACE,
        seeds = [COMMUNITY_SEED, mint.key().as_ref(), admin.key().as_ref()],
        bump
    )]
    pub community: Account<'info, Community>,
    #[account(
        init,
        payer = admin,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, community.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

pub fn process_initialize_community(
    ctx: Context<InitializeCommunity>,
    fee_recipient: Pubkey,
) -> Result<()> {
    require!(
        fee_recipient != Pubkey::default()
            && fee_recipient != ctx.accounts.community.key()
            && fee_recipient != ctx.accounts.vault.key(),
        HyphaeError::InvalidFeeRecipient
    );
    ctx.accounts.community.set_inner(Community {
        mint: ctx.accounts.mint.key(),
        admin: ctx.accounts.admin.key(),
        fee_recipient,
        outstanding_lamports: 0,
        bump: ctx.bumps.community,
        vault_bump: ctx.bumps.vault,
    });
    ctx.accounts.vault.set_inner(Vault {
        bump: ctx.bumps.vault,
    });
    Ok(())
}
