public class Product
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Category { get; set; }
    public decimal PriceEth { get; set; }
    public string? ImageUrl { get; set; }
}

public class OrderItem
{
    public int ProductId { get; set; }
    public int Quantity { get; set; }
}

public class Order
{
    public int Id { get; set; }
    public string? UserWallet { get; set; }
    public List<OrderItem> Items { get; set; } = new();
    public bool IsPaid { get; set; }
    public decimal TotalEth { get; set; }
    public string? TxHash { get; set; }
    public long OnchainOrderId { get; set; }
}

public class User
{
    public string? Wallet { get; set; }
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }
    public DateTime CreatedAt { get; set; }
}