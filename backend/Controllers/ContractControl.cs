using Microsoft.AspNetCore.Mvc;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;
using Nethereum.Web3;
using System.Numerics;
using WebApplication1;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts;

[Function("owner", "address")]
public class OwnerFunction : FunctionMessage
{
}

[Function("getBalance", "uint256")]
public class GetBalanceFunction : FunctionMessage
{
}


namespace WebApplication1.Controllers
{
    [ApiController]
    [Route("api/contract")]
    public class ContractController : ControllerBase
    {
        private readonly Web3 _web3;
        private readonly IConfiguration _cfg;

        public ContractController(Web3 web3, IConfiguration cfg)
        {
            _web3 = web3;
            _cfg = cfg;
        }

        //[HttpGet("debug")]
        //public async Task<IActionResult> Debug()
        //{
        //    var contractAddress = _cfg["Blockchain:ContractAddress"]!;


        //    var code = await _web3.Eth.GetCode.SendRequestAsync(contractAddress);
        //    var codeLen = (code?.Length ?? 0);


        //    var callInput = new Nethereum.RPC.Eth.DTOs.CallInput
        //    {
        //        To = contractAddress,
        //        Data = "0x8da5cb5b"
        //    };

        //    var raw = await _web3.Eth.Transactions.Call.SendRequestAsync(callInput);

        //    string? decodedOwner = null;
        //    if (!string.IsNullOrWhiteSpace(raw) && raw != "0x" && raw.Length >= 66)
        //    {

        //        decodedOwner = "0x" + raw.Substring(raw.Length - 40);
        //    }

        //    return Ok(new
        //    {
        //        contractAddress,
        //        code,
        //        codeLen,
        //        ownerCallData = "0x8da5cb5b",
        //        ownerRaw = raw,
        //        ownerDecoded = decodedOwner
        //    });
        //}

        [HttpGet("info")]
        public async Task<IActionResult> Info()
        {
            var contractAddress = _cfg["Blockchain:ContractAddress"];
            if (string.IsNullOrWhiteSpace(contractAddress))
                return BadRequest("Blockchain:ContractAddress is missing in appsettings.json");

            var handler = _web3.Eth.GetContractHandler(contractAddress);

            string owner;
            BigInteger balanceWei;

            try
            {
                owner = await handler.QueryAsync<OwnerFunction, string>(new OwnerFunction());
                balanceWei = await handler.QueryAsync<GetBalanceFunction, BigInteger>(new GetBalanceFunction());
            }
            catch (Exception ex)
            {

                return Problem(detail: ex.Message, title: "Blockchain call failed");
            }

            return Ok(new
            {
                contractAddress,
                owner,
                balanceWei = balanceWei.ToString()
            });
        }
    }
}

