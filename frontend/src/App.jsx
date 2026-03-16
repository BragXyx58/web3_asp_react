import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import "./App.css";

const API = "http://localhost:5220/api";

const CONTRACT_ABI = [
  "function payOrder(uint256 _orderId) external payable",
  "function owner() view returns (address)",
  "function getBalance() view returns (uint256)"
];

export default function App() {
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [account, setAccount] = useState("");
  const [userOrders, setUserOrders] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [contractInfo, setContractInfo] = useState(null);
  const [view, setView] = useState("shop"); 
  const [cart, setCart] = useState([]);
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [profileForm, setProfileForm] = useState({
    displayName: "",
    email: "",
    address: "",
  });
  const [adminForm, setAdminForm] = useState({
    name: "",
    priceEth: "",
    category: "",
    imageUrl: "",
  });
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const byCategory = !category || p.category === category;
      const bySearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.category || "").toLowerCase().includes(search.toLowerCase());
      return byCategory && bySearch;
    });
  }, [products, category, search]);

  const cartTotalEth = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + item.product.priceEth * item.quantity,
        0
      ),
    [cart]
  );

  const loadProducts = async () => {
    const res = await axios.get(
      `${API}/shop/products${category ? "?cat=" + category : ""}`
    );
    setProducts(res.data);
  };

  const loadUserOrders = async (wallet) => {
    const res = await axios.get(`${API}/shop/user/${wallet}`);
    setUserOrders(res.data);
  };

  const loadContractInfo = async () => {
    try {
      const res = await axios.get(`${API}/contract/info`);
      setContractInfo(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const connect = async () => {
    if (!window.ethereum) {
      alert("Нужен установленный кошелек (MetaMask и т.п.)");
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    setAccount(address);

    try {
      const res = await axios.get(`${API}/account/${address}`);
      setUserProfile(res.data);
      setProfileForm({
        displayName: res.data.displayName || "",
        email: res.data.email || "",
        address: res.data.address || "",
      });
    } catch (err) {
      try {
        const createRes = await axios.post(`${API}/account/register`, {
          wallet: address,
        });
        setUserProfile(createRes.data);
        setProfileForm({
          displayName: createRes.data.displayName || "",
          email: "",
          address: "",
        });
      } catch (e) {
        console.error(e);
      }
    }

    await loadUserOrders(address);
    await loadContractInfo();
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateCartQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const clearCart = () => setCart([]);

  const toggleFavorite = (productId) => {
    setFavoriteIds((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const createProduct = async () => {
    if (!adminForm.name || !adminForm.priceEth) {
      alert("Заполни название и цену товара");
      return;
    }
    try {
      await axios.post(`${API}/shop/products`, {
        name: adminForm.name,
        category: adminForm.category || "Разное",
        priceEth: parseFloat(adminForm.priceEth.replace(",", ".")) || 0,
        imageUrl: adminForm.imageUrl || "",
      });
      setAdminForm({ name: "", priceEth: "", category: "", imageUrl: "" });
      await loadProducts();
      alert("Товар добавлен");
    } catch (e) {
      console.error(e);
      alert("Не удалось создать товар");
    }
  };

  const saveProfile = async () => {
    if (!account) {
      await connect();
      if (!account) return;
    }

    try {
      const res = await axios.post(`${API}/account/register`, {
        wallet: account,
        displayName: profileForm.displayName,
        email: profileForm.email,
        address: profileForm.address,
      });
      setUserProfile(res.data);
      alert("Профиль сохранён");
    } catch (e) {
      console.error(e);
      alert("Не удалось сохранить профиль");
    }
  };

  const checkout = async () => {
    if (!account) {
      await connect();
      if (!account) return;
    }
    if (cart.length === 0) {
      alert("Корзина пуста");
      return;
    }

    if (
      !userProfile ||
      !userProfile.email ||
      !userProfile.address ||
      userProfile.email.trim() === "" ||
      userProfile.address.trim() === ""
    ) {
      alert("Заполни профиль (email и адрес) перед покупкой.");
      setView("profile");
      return;
    }

    try {
      setLoadingCheckout(true);

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      let contractAddress =
        contractInfo?.contractAddress ||
        "0xC15e6f898FD5da861303c76c9da7874d97460Ec0";

      const contract = new ethers.Contract(
        contractAddress,
        CONTRACT_ABI,
        signer
      );

      const onchainOrderId = Date.now();
      const totalEthString = cartTotalEth.toFixed(6);

      const tx = await contract.payOrder(onchainOrderId, {
        value: ethers.parseEther(totalEthString),
      });
      await tx.wait();

      const orderPayload = {
        userWallet: account,
        items: cart.map((c) => ({
          productId: c.product.id,
          quantity: c.quantity,
        })),
        isPaid: true,
        totalEth: cartTotalEth,
        txHash: tx.hash,
        onchainOrderId,
      };

      await axios.post(`${API}/shop/checkout`, orderPayload);

      alert("Заказ оплачен и сохранен!");
      clearCart();
      await loadUserOrders(account);
    } catch (e) {
      console.error(e);
      alert("Ошибка при оплате заказа. См. консоль.");
    } finally {
      setLoadingCheckout(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [category]);

  return (
    <div className="app">
      <nav className="navbar">
        <div className="navbar-left">
        </div>
        <div className="navbar-center">
          <button className={`btn ${view === "shop" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("shop")}>
            Магазин
          </button>
          <button className={`btn ${view === "cart" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("cart")}>
            Корзина ({cart.reduce((s, i) => s + i.quantity, 0)})
          </button>
        <button
            className={`btn ${view === "profile" ? "btn-primary" : "btn-ghost"}`}
          onClick={async () => {
            setView("profile");
            if (!account) {
              await connect();
            } else {
              await loadUserOrders(account);
              await loadContractInfo();
            }
          }}
        >
          Личный кабинет
        </button>
          <button
            className={`btn ${view === "admin" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setView("admin")}
          >
            Админ
          </button>
        </div>
        <div className="navbar-right">
          {account ? (
            <span>Вы: {account.slice(0, 6)}...</span>
          ) : (
            <button className="btn btn-outline" onClick={connect}>
              Подключить кошелек
            </button>
          )}
        </div>
      </nav>

      {view === "shop" && (
        <div className="section">
          <h3>Товары</h3>
          <div className="filters">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Все категории</option>
              <option value="Одежда">Одежда</option>
              <option value="Аксессуары">Аксессуары</option>
            </select>
            <input
              type="text"
              placeholder="Поиск по названию или категории"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="products-grid">
            {filteredProducts.map((p) => (
              <div key={p.id} className="card product-card">
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <h4>{p.name}</h4>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 0 }}
                    onClick={() => toggleFavorite(p.id)}
                    title="Избранное"
                  >
                    {favoriteIds.has(p.id) ? "❤️" : "🤍"}
                  </button>
                </div>
                {p.imageUrl && (
                  <div style={{ marginBottom: 8 }}>
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      style={{
                        width: "100%",
                        height: 140,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                      }}
                    />
                  </div>
                )}
                <p>
                  Категория: <b>{p.category}</b>
                </p>
                <p>
                  Цена: <b>{p.priceEth} ETH</b>
                </p>
                <button className="btn btn-primary" onClick={() => addToCart(p)}>
                  В корзину
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "cart" && (
        <div className="section">
          <h3>Корзина</h3>
          {cart.length === 0 ? (
            <p>Корзина пуста</p>
          ) : (
            <div>
              {cart.map((item) => (
                <div key={item.product.id} className="cart-item">
                  <div className="cart-item-main">
                    {item.product.name} ({item.product.priceEth} ETH)
                  </div>
                  <div className="cart-item-qty">
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        updateCartQuantity(item.product.id, -1)
                      }
                    >
                      -
                    </button>
                    <span className="cart-item-qty-value">{item.quantity}</span>
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        updateCartQuantity(item.product.id, 1)
                      }
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-item-sum">
                    {(item.product.priceEth * item.quantity).toFixed(6)} ETH
                  </div>
                </div>
              ))}
              <div className="cart-total">
                <strong>Итого:</strong>
                <strong>{cartTotalEth.toFixed(6)} ETH</strong>
              </div>
              <div className="cart-actions">
                <button className="btn btn-ghost" onClick={clearCart}>
                  Очистить корзину
                </button>
                <button
                  className="btn btn-primary"
                  onClick={checkout}
                  disabled={loadingCheckout}
                >
                  {loadingCheckout ? "Оплата..." : "Оплатить криптой"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "profile" && (
        <div className="section">
          <h3>Личный кабинет</h3>
          {!account ? (
            <p>Подключите кошелек, чтобы увидеть профиль.</p>
          ) : (
            <>
              <div className="profile-summary">
                <p>
                  Кошелек: <b>{account}</b>
                </p>
                {userProfile && (
                  <p>
                    Создан:{" "}
                    {new Date(userProfile.createdAt).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="profile-form">
                <h4>Профиль покупателя</h4>
                <p className="profile-hint">
                  Имя, email и адрес нужны, чтобы оформить покупку.
                </p>
                <label className="field">
                  <span>Имя</span>
                  <input
                    type="text"
                    value={profileForm.displayName}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        displayName: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        email: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="field">
                  <span>Адрес доставки / контакты</span>
                  <textarea
                    rows={3}
                    value={profileForm.address}
                    onChange={(e) =>
                      setProfileForm((f) => ({
                        ...f,
                        address: e.target.value,
                      }))
                    }
                  />
                </label>
                <button className="btn btn-primary" onClick={saveProfile}>
                  Сохранить профиль
                </button>
              </div>

              {contractInfo && (
                <div className="card contract-card">
                  <h4>Смарт-контракт магазина</h4>
                  <p>
                    Адрес: <code>{contractInfo.contractAddress}</code>
                  </p>
                  <p>
                    Владелец: <code>{contractInfo.owner}</code>
                  </p>
                  <p>
                    Баланс контракта:{" "}
                    {ethers.formatEther(
                      BigInt(contractInfo.balanceWei || "0")
                    )}{" "}
                    ETH
                  </p>
                </div>
              )}

              <h4>Избранные товары</h4>
              {products.filter((p) => favoriteIds.has(p.id)).length === 0 ? (
                <p>Нет избранных товаров</p>
              ) : (
                products
                  .filter((p) => favoriteIds.has(p.id))
                  .map((p) => (
                    <div key={p.id} className="card order-card">
                      <div>
                        {p.name} — {p.priceEth} ETH
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12 }}>
                        Категория: {p.category}
                      </div>
                    </div>
                  ))
              )}

              <h4>Мои заказы</h4>
              {userOrders.length === 0 ? (
                <p>Заказов нет</p>
              ) : (
                userOrders.map((o) => (
                  <div key={o.id} className="card order-card">
                    <div>
                      Заказ №{o.id} — {o.totalEth} ETH
                    </div>
                    {o.txHash && (
                      <div style={{ fontSize: 12 }}>
                        Tx: <code>{o.txHash}</code>
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      Товары:
                      <ul>
                        {o.items?.map((it) => (
                          <li key={it.productId}>
                            ID товара {it.productId} × {it.quantity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      {view === "admin" && (
        <div className="section">
          <h3>Админ‑панель</h3>
          <div className="profile-form">
            <h4>Добавить товар</h4>
            <label className="field">
              <span>Название</span>
              <input
                type="text"
                value={adminForm.name}
                onChange={(e) =>
                  setAdminForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Цена (ETH)</span>
              <input
                type="text"
                value={adminForm.priceEth}
                onChange={(e) =>
                  setAdminForm((f) => ({ ...f, priceEth: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>Категория</span>
              <input
                type="text"
                value={adminForm.category}
                placeholder="Например, Одежда"
                onChange={(e) =>
                  setAdminForm((f) => ({ ...f, category: e.target.value }))
                }
              />
            </label>
            <label className="field">
              <span>URL картинки (необязательно)</span>
              <input
                type="text"
                value={adminForm.imageUrl}
                placeholder="https://..."
                onChange={(e) =>
                  setAdminForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
              />
            </label>
            <button className="btn btn-primary" onClick={createProduct}>
              Добавить товар
            </button>
          </div>
        </div>
      )}
    </div>
  );
}