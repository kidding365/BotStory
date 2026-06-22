# Onboarding Flow

The Infinite Worlds onboarding process is designed to gate content and handle authentication before entering the game loop.

## Flow Sequence
1. **Landing Page:** User arrives at `infiniteworlds.app`.
2. **Entry Point:** User clicks "Play now".
3. **Account Selection:**
   - **Option A: New Player** -> Proceed to age verification.
   - **Option B: Log in** -> Authentication flow (likely OAuth or email/password).
4. **Age Verification:** Users must confirm they are 18+ and agree to Terms and Conditions.
5. **Game Entry:** Once authenticated/verified, the user is directed to the World Browser or their last played game.

## BotStory Design Considerations
- **Low Friction:** For BotStory, we could simplify this to a "Guest Mode" where the game state is saved in `localStorage` to allow immediate play.
- **Custom Onboarding:** Instead of a simple age gate, we could introduce the "World" concepts (Main Instructions, etc.) to the player during onboarding to set expectations.
