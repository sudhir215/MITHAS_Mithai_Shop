import {Router} from "express";
import {
  getCategories,
  getOrderConfirmation,
  getProduct,
  getProducts,
  getStoreSettingsController,
  postCheckout,
} from "../controllers/catalogController.js";

const catalogRouter = Router();

catalogRouter.get("/products", getProducts);
catalogRouter.get("/products/:slug", getProduct);
catalogRouter.get("/categories", getCategories);
catalogRouter.get("/store-settings", getStoreSettingsController);
catalogRouter.post("/orders", postCheckout);
catalogRouter.get("/orders/:orderNumber", getOrderConfirmation);

export default catalogRouter;
