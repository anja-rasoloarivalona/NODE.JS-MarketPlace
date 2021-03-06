const Product = require('../models/product');
const User = require('../models/user');
const Address = require('../models/address');
const Order = require('../models/order');
const mongoose = require('mongoose');


exports.getProductTest = (req, res, next) => {

    let category = req.query.category;

  


    let price = req.params.price;
    let priceReq;
    let totalProducts;

    const currentPage = req.query.page || 1;
    const perPage = 10;

    let sort;
    if(req.params.sort === 'latest'){
        sort = {createdAt: -1}
    }
    if(req.params.sort === 'low_to_high'){
        sort = {price: 1}
    }
    if(req.params.sort === 'high_to_low'){
        sort = {price: -1}
    } 

    let priceMax;
    let priceMin;


    if(!price.includes('undefined')){
        priceReq = { price: {$gte: price.split('&&')[0], $lte: price.split('&&')[1]} }
    } else {
        priceReq = { price: {$gte: 0}}
    }

    let find = priceReq;

    if(!category.includes('undefined')  && category != ''){
        console.log('cat going', category);
        find = {...find, category: category};

    } else {
        console.log('cat fucked');
    }

   // ({category: category, price: {$gte: min, $lte: max} })
    

    Product
    .find(find)
    .sort({ price : 1})
    .then( products => {
        priceMin = products[0].price;
        priceMax = products[products.length - 1].price;

        console.log(products.length);

        return Product
                .find(find)
                .countDocuments()      
    })
    .then( count => {
        totalProducts = count;
        return Product
                .find(find)
                .sort(sort)
                .skip((currentPage - 1) * perPage) 
                .limit(perPage)
    })
    .then( products => {
        res
        .status(200)
        .json({message: 'Fetched products successfully.', 
               products: products,
               priceMin: priceMin,
               priceMax: priceMax,
               totalProducts: totalProducts})
    })
    .catch(err =>{
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}


exports.postOrder = (req, res, next) => {

    let userId = req.userId;
    let userConnected;

    let currentUserOrder;

    let address = JSON.parse( req.body.address); 

    const deliveryDate = req.body.deliveryDate;
    const subTotalPrice = req.body.subTotalPrice;
    const taxes = req.body.taxes;
    const deliveryPrice = req.body.deliveryPrice;
    const totalPrice = req.body.totalPrice;
    const totalProductsCount = req.body.totalProductsCount


    let cart = {};

    let products;


    User
        .findById(userId)
        .then( user => {
            userConnected = user;
            userConnected
                .populate('cart.items.product')
                .execPopulate()
                .then( user => {
                    products = user.cart.items.map(i => {
                        return { product: {...i.product._doc} }
                    })
                })
                .then( () => {
                    cart = {
                        items: products,
                        subTotalPrice: subTotalPrice,
                        taxes: taxes,
                        deliveryFee: deliveryPrice,
                        totalPrice: totalPrice,
                        totalProductsCount: totalProductsCount
                    }

                    const order = new Order({
                        cart: cart,
                        address: address,
                        creator: userId,
                        deliveryDate: deliveryDate
                    })

                    currentUserOrder = order
                    return order.save()
                })
                .then( () => {
                    userConnected.orders.push(currentUserOrder);
                    return user.save()
                })
                .then(() => {
                    res.status(201).json({
                        message: 'Order added successfully',
                        order: currentUserOrder
                    })
                })
                .catch(err => {
                    if (!err.statusCode) {
                      err.statusCode = 500;
                    }
                    next(err);
                  });               
        })    
}


exports.getAddress = (req, res, next) => {
    Address
    .find({creator: req.userId})
    .then( addresses => {
        res
          .status(200)
          .json({
              message: 'Fetched user addresses',
              addresses: addresses
          })
    })
    .catch(err => {
        if(!err.statusCode){
          err.statusCode= 500;
        }
        next(err)
      })
}

exports.setCart = (req, res, next) => {
    let products = JSON.parse(req.body.products);
    let productsInCart;   
    let userId = req.userId;
    let userConnected;
    let productsIds = [];
    products.forEach(product => {
        let id = product.productId;
        productsIds = [...productsIds,  mongoose.Types.ObjectId(id) ];

        console.log('set cart products ids', productsIds)
    })

    

    User
    .findById(userId)
    .then(user => {
        userConnected = user;
        return  Product.find({
            _id : { $in: productsIds}
        })
    })
    .then( products => {
        productsInCart = products;
        return userConnected.setProductToCart(products)
    })
    .then( () => {
        res
        .status(200)
        .json({message: 'Set products successfully.', 
               products: productsInCart,
               totalProductsCount: userConnected.cart.totalProductsCount,
               subTotalPrice:  userConnected.cart.subTotalPrice,
               taxes: userConnected.cart.taxes,
               totalPrice: userConnected.cart.totalPrice,
               taxRate: userConnected.cart.taxRate})
    } )
    .catch(err =>{
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.clearProductsInCart = (req, res, next) => {
    let userId = req.userId;
    let userConnected;

    User
    .findById(userId)
    .then(user => {
        userConnected = user;
        return userConnected.clearProductsInCart()
    })
    .then( () =>{
        res
        .status(200)
        .json({ message: 'Products in cart Deleted'})
    })
    .catch(err =>{
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.getOrder = (req, res, next ) => {
    let userOrders = [];

    Order
        .find({creator: req.userId})
        .then(orders => {
            return userOrders = orders;   
        })
        .then(() => {
            console.log('will send reponse')
            res
                .status(200)
                .json({ message: 'Fetched Orders', orders: userOrders }) 
        })
        .catch( err => {
            if(!err.statusCode){
                err.statusCode = 500
            }
            next(err)
        })
}

exports.addProductToCart = (req, res, next) => {
    const prodId = req.params.prodId; 
    let userId = req.userId;

    let userConnected

    User
    .findById(userId)
    .then(user => {
        userConnected = user;
        return Product.findById(prodId)      
    })
    .then( product => {
        return userConnected.addProductToCart(product)
    })
    .then( () => {
        res
        .status(200)
        .json({ message: 'Product added to cart'})
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}

exports.deleteProductInCart = (req, res, next) => {
    const prodId = req.params.prodId;
    let userId = req.userId;
    let userConnected

    User
    .findById(userId)
    .then(user => {
        userConnected = user;
        return Product.findById(prodId)      
    })
    .then( product => {
        return userConnected.deleteProductInCart(product)
    })
    .then( () => {
        res
        .status(200)
        .json({ message: 'Product added to cart'})
    })
    .catch(err => {
        if(!err.statusCode){
            err.statusCode = 500;
        }
        next(err)
    })
}


exports.addUserInfo = (req, res, next) => {

    let userId = req.userId;
    let userConnected;


    const fullname = req.body.fullname;
    const address1 = req.body.address1;
    const address2 = req.body.address2;
    const city = req.body.city;
    const state = req.body.state;
    const zip = req.body.zip;
    const email = req.body.email;
    const phoneNumber = req.body.phoneNumber;



    const address = new Address({
        fullname: fullname,
        address1: address1,
        address2: address2,
        city: city,
        state: state,
        zip: zip,
        email: email,
        phoneNumber: phoneNumber,
        creator: userId
    })

    address
        .save()
        .then( () => {
            return User
                    .findById(userId)
        })
        .then(user => {
            userConnected = user;
            userConnected.userInfos.push(address);
            return user.save()
        })
        .then(() => {
            res.status(201).json({
                message: 'Address added successfully',
                address: address,
                creator: { _id: userConnected._id, name: userConnected.name}
            })
        })
        .catch(err => {
            if (!err.statusCode) {
              err.statusCode = 500;
            }
            next(err);
          });
}

exports.getProduct = (req, res, next) => {
    const prodId = req.params.prodId;
    const ID = mongoose.Types.ObjectId(prodId);
    Product.findById(ID)
        .then(prod => {
            if(!prod){
                const error = new Error('Product not found')
                error.statusCode = 404;
                throw err
            }

            res.status(200).json({message:'Product fetched', product: prod})
        })
        .catch(err => {
            if(!err.statusCode){
                err.statusCode = 500;
            }

            next(err);
        })
}