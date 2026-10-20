# Contributing to Koharu

Thank you for your interest in improving Koharu! We welcome pull requests, feature suggestions, and bug reports.

## Development Setup

1. **Clone your fork**:
   ```bash
   git clone https://github.com/<your-username>/koharu.git
   cd koharu
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run tests**:
   Make sure all tests pass before submitting changes:
   ```bash
   npm test
   ```

## Code Guidelines

- **Style**: Use clean, modern ECMAScript with clear modular boundaries.
- **Tone**: Keep user-facing messages cute, helpful, and polite.
- **Testing**: Whenever you add or adjust core mechanics (economy, card math, hex manipulation), write unit tests in `test/`.
- **Database**: Use prepared statements exclusively to prevent SQL injection.

## Pull Request Checklist

- [ ] Code follows existing architectural patterns.
- [ ] All unit tests pass (`npm test`).
- [ ] PR title is concise and descriptive.
- [ ] No personal tokens or sensitive data are committed.
