function validatePurchase(body, validCategoryIds) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Invalid request body.' };
  }

  const { name, quantity, unitPriceCents, categoryId } = body;

  // Name validation
  if (typeof name !== 'string' || name.trim() === '') {
    return { error: 'Investment name is required and must be a non-empty string.' };
  }
  const trimmedName = name.trim();
  if (trimmedName.length > 100) {
    return { error: 'Investment name must be between 1 and 100 characters.' };
  }

  // Quantity validation
  if (
    typeof quantity !== 'number' ||
    !Number.isInteger(quantity) ||
    !Number.isFinite(quantity) ||
    quantity < 1 ||
    quantity > 10000
  ) {
    return { error: 'Quantity must be an integer between 1 and 10,000.' };
  }

  // unitPriceCents validation
  if (
    typeof unitPriceCents !== 'number' ||
    !Number.isInteger(unitPriceCents) ||
    !Number.isFinite(unitPriceCents) ||
    unitPriceCents < 1 ||
    unitPriceCents > 100000000
  ) {
    return { error: 'Unit price in cents must be an integer between 1 and 100,000,000.' };
  }

  // categoryId validation
  if (
    typeof categoryId !== 'number' ||
    !Number.isInteger(categoryId) ||
    !Number.isFinite(categoryId) ||
    !validCategoryIds.has(categoryId)
  ) {
    return { error: 'Selected category is invalid.' };
  }

  return {
    value: {
      name: trimmedName,
      quantity,
      unitPriceCents,
      categoryId
    }
  };
}

module.exports = { validatePurchase };