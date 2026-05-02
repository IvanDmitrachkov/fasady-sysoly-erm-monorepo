/** Номер заказа для UI: ведущие нули до 6 цифр, дальше без обрезки. */
export function formatOrderNumber(orderNumber) {
    if (orderNumber < 1_000_000) {
        return String(orderNumber).padStart(6, "0");
    }
    return String(orderNumber);
}
//# sourceMappingURL=order-number.js.map