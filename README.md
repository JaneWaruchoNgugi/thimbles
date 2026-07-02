Build a unique mobile-first Thimbles game called ShellRush using React, TypeScript, Vite, and Canvas animation.

Theme:
Dark futuristic casino UI with neon cyan, purple, pink, and gold accents. The design should feel similar to a premium live casino game.

Game mechanics:
- Player selects bet amount.
- Player selects difficulty: Easy 3 shells, Medium 4 shells, Hard 5 shells, Extreme 6 shells.
- A glowing gem/ball is shown under one shell.
- Shells cover the gem.
- Shells shuffle smoothly with animated paths.
- After shuffle, player picks one shell.
- Reveal animation shows win or loss.
- Calculate payout based on difficulty.
- Update balance, total bets, total wins, win rate, biggest win, and recent results.

Unique features:
- Fake Glow Shell effect during shuffle.
- Teleport swap animation between two shells.
- Neon trail behind moving shells.
- Camera shake on reveal.
- Energy pulse when player wins.
- How To Play bottom sheet.
- Sound toggle button.
- Mobile-first layout.

UI sections:
- Header with logo ShellRush LIVE, balance, sound icon, profile initials.
- Game arena with shells and glowing platform.
- Bet controls.
- Difficulty selector.
- Start Game button.
- Statistics cards.
- Trend chart.
- Live table.

Technical requirements:
- Use clean component structure.
- Use React hooks.
- Use CSS animations where possible.
- Use Canvas for shell movement if needed.
- Make it responsive for mobile and desktop.
- Add mock player names in live table.
- No backend required for now.