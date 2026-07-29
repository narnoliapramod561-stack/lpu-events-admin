describe('OTP email domain validation', () => {
  it('allows any valid email address', () => {
    const email = 'user@example.com';
    const isAllowed = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(email);

    expect(isAllowed).toBe(true);
  });

  it('rejects malformed emails', () => {
    const email = 'not-an-email';
    const isAllowed = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i.test(email);

    expect(isAllowed).toBe(false);
  });
});
