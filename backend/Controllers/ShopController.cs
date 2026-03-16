using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class ShopController : ControllerBase
{
    private static readonly List<Product> Products = new()
    {
        new Product { Id = 1, Name = "Футболка", Category = "Одежда", PriceEth = 0.001m },
        new Product { Id = 2, Name = "Наушники", Category = "Аксессуары", PriceEth = 0.005m }
    };

    private static readonly List<Order> Orders = new();

    [HttpGet("products")]
    public IActionResult GetProducts(string? cat)
    {
        return Ok(string.IsNullOrWhiteSpace(cat)
            ? Products
            : Products.Where(p => p.Category == cat));
    }

    [HttpPost("products")]
    public IActionResult CreateProduct([FromBody] Product product)
    {
        if (string.IsNullOrWhiteSpace(product.Name))
        {
            return BadRequest("Name is required");
        }

        product.Id = Products.Count == 0 ? 1 : Products.Max(p => p.Id) + 1;
        Products.Add(product);
        return Ok(product);
    }

    [HttpDelete("products/{id:int}")]
    public IActionResult DeleteProduct(int id)
    {
        var existing = Products.FirstOrDefault(p => p.Id == id);
        if (existing == null)
        {
            return NotFound();
        }

        Products.Remove(existing);
        return NoContent();
    }

    [HttpPost("checkout")]
    public IActionResult Checkout([FromBody] Order order)
    {
        order.Id = Orders.Count + 1;
        order.IsPaid = true;
        if (order.Items == null)
        {
            order.Items = new List<OrderItem>();
        }
        Orders.Add(order);
        return Ok(order);
    }

    [HttpGet("user/{wallet}")]
    public IActionResult GetUserOrders(string wallet)
    {
        var normalized = wallet.ToLowerInvariant();
        return Ok(Orders.Where(o => (o.UserWallet ?? string.Empty).ToLowerInvariant() == normalized));
    }
}