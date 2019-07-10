const express = require('express');

const router = express.Router();
const shopController = require('../controllers/shop');



router.get('/', shopController.getIndex);
router.get('/:category', shopController.getProductByCategory);
router.get('/:category/:prodId', shopController.getProduct);




module.exports = router;