-- Ajoute 'mycoolpay' à l'enum PaymentProviderName
ALTER TABLE Payment 
MODIFY provider ENUM('stripe', 'flutterwave', 'mycoolpay') NOT NULL;

-- Ajoute 'mobile_money_mycoolpay' à l'enum ProviderPaymentMethod
ALTER TABLE Payment 
MODIFY providerPaymentMethod ENUM('card', 'mobile_money_franco', 'mobile_money_mycoolpay');
