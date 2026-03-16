using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;

[ApiController]
[Route("api/[controller]")]
public class AccountController : ControllerBase
{
    private static readonly List<User> Users = new();

    [HttpPost("register")]
    public IActionResult Register([FromBody] User user)
    {
        if (string.IsNullOrWhiteSpace(user.Wallet))
        {
            return BadRequest("Wallet is required");
        }

        var walletNormalized = user.Wallet.ToLowerInvariant();
        var existing = Users.FirstOrDefault(u => u.Wallet!.ToLowerInvariant() == walletNormalized);
        if (existing != null)
        {
            // обновляем профиль существующего пользователя
            if (!string.IsNullOrWhiteSpace(user.DisplayName))
            {
                existing.DisplayName = user.DisplayName;
            }
            if (!string.IsNullOrWhiteSpace(user.Email))
            {
                existing.Email = user.Email;
            }
            if (!string.IsNullOrWhiteSpace(user.Address))
            {
                existing.Address = user.Address;
            }
            return Ok(existing);
        }

        user.Wallet = walletNormalized;
        if (string.IsNullOrWhiteSpace(user.DisplayName))
        {
            user.DisplayName = $"User {user.Wallet[..6]}";
        }

        user.CreatedAt = DateTime.UtcNow;
        Users.Add(user);
        return Ok(user);
    }

    [HttpGet("{wallet}")]
    public IActionResult Get(string wallet)
    {
        if (string.IsNullOrWhiteSpace(wallet))
        {
            return BadRequest("Wallet is required");
        }

        var walletNormalized = wallet.ToLowerInvariant();
        var existing = Users.FirstOrDefault(u => u.Wallet!.ToLowerInvariant() == walletNormalized);
        if (existing == null)
        {
            return NotFound();
        }

        return Ok(existing);
    }
}

