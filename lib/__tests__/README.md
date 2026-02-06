# Test Suite

This directory contains unit tests for the TechLancer application.

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Test Files

- `validation.test.ts` - Tests for validation functions (email, password, age, date formatting)
- `api.test.ts` - Tests for API service methods (register, login)

## Test Coverage

The test suite covers:
- ✅ Email validation
- ✅ Password strength calculation
- ✅ Password requirements checking
- ✅ Age validation (18+)
- ✅ Date input formatting
- ✅ API service methods
- ✅ Error handling

## Adding New Tests

When adding new functionality:
1. Create corresponding test file in `__tests__` directory
2. Follow existing test patterns
3. Ensure tests are isolated and don't depend on external services
4. Mock external dependencies (API calls, Supabase, etc.)

## Best Practices

- Use descriptive test names
- Test both success and error cases
- Test edge cases and boundary conditions
- Keep tests fast and independent
- Mock external dependencies
