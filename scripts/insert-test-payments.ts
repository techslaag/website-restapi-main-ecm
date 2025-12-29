import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL || "mysql://dev_su:Admin7894@!@vps101272.serveur-vps.net:3306/c2284369c_ecomatin_testing"
});

const testUsers = [
  {
    email: 'ntiou.codeur@gmail.com',
    name: 'Ntiou Codeur',
    userId: 'test_user_id_1'
  },
  {
    email: 'joel.ntiou@ecomatin.net',
    name: 'Joel Ntiou',
    userId: 'test_user_id_2'
  }
];

const failureReasons = [
  {
    reason: 'card_declined',
    message: 'Your card was declined.',
    details: 'insufficient_funds'
  },
  {
    reason: 'expired_card',
    message: 'Your card has expired.',
    details: 'card_expired'
  },
  {
    reason: 'processing_error',
    message: 'Payment processing failed.',
    details: 'generic_decline'
  },
  {
    reason: 'invalid_cvc',
    message: 'Your card\'s security code is incorrect.',
    details: 'incorrect_cvc'
  }
];

const testAmounts = [9.99, 29.99, 49.99, 99.99];

async function insertTestFailedPayments() {
  console.log('🚀 Inserting test failed payment records into backend database...');
  
  try {
    // First, clear any existing test payments to avoid duplicates
    const deletedCount = await prisma.payment.deleteMany({
      where: {
        paymentProviderId: {
          startsWith: 'mycoolpay_test_payment_'
        }
      }
    });
    console.log(`🧹 Cleaned up ${deletedCount.count} existing test payments`);

    let insertedCount = 0;

    for (let userIndex = 0; userIndex < testUsers.length; userIndex++) {
      const user = testUsers[userIndex];
      
      for (let failureIndex = 0; failureIndex < failureReasons.length; failureIndex++) {
        const failure = failureReasons[failureIndex];
        const amount = testAmounts[failureIndex % testAmounts.length];
        const daysAgo = Math.floor(Math.random() * 30) + 1; // 1-30 days ago
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);

        const paymentId = `test_payment_${userIndex}_${failureIndex}_${Date.now()}`;
        const reference = `PAY-TEST-${Date.now()}-${userIndex}${failureIndex}`;
        
        // Create error metadata
        const errorData = {
          decline_code: failure.details,
          message: failure.message,
          type: failure.reason,
          timestamp: createdAt.toISOString(),
          test_mode: true
        };

        const userMetadata = {
          email: user.email,
          name: user.name,
          test_user: true
        };

        try {
          await prisma.payment.create({
            data: {
              id: paymentId,
              externalId: `ext_${paymentId}`,
              reference: reference,
              status: 'failed',
              paidAmount: amount,
              paidAmountCurrency: 'eur',
              receivedAmount: 0.00,
              receivedCurrency: 'eur',
              provider: 'mycoolpay',
              paymentProviderId: `mycoolpay_${paymentId}`,
              meta: JSON.stringify(userMetadata),
              errors: JSON.stringify(errorData),
              webhookPayloads: JSON.stringify({ webhook_received: true, test_data: true }),
              createdAt: createdAt,
              updatedAt: new Date(),
              userId: user.userId,
              clientCountryAlpha2Code: 'FR',
              mobileOperator: 'mobile_test'
            }
          });

          insertedCount++;
          console.log(`✅ Inserted test payment ${userIndex + 1}.${failureIndex + 1} for ${user.email} - ${amount}€ - ${failure.reason}`);
        } catch (error: any) {
          console.error(`❌ Failed to insert payment ${paymentId}:`, error.message);
        }
      }
    }

    console.log(`🎉 Successfully inserted ${insertedCount} test failed payments!`);
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Go to http://localhost:3000/automation');
    console.log('2. Click "Configure" on the MyCoolPay automation');
    console.log('3. You should see the test failed payments for both test users');
    
  } catch (error: any) {
    console.error('❌ Error inserting test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to verify the test data was inserted correctly
async function verifyTestData() {
  console.log('🔍 Verifying test data...');
  
  try {
    const testPayments = await prisma.payment.findMany({
      where: {
        provider: 'mycoolpay',
        status: 'failed',
        paymentProviderId: {
          startsWith: 'mycoolpay_test_payment_'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${testPayments.length} test failed payments`);
    
    if (testPayments.length > 0) {
      console.log('👥 Test payments summary:');
      testPayments.forEach((payment, index) => {
        const meta = JSON.parse(payment.meta || '{}');
        const errors = JSON.parse(payment.errors || '{}');
        console.log(`   ${index + 1}. ${meta.name} (${meta.email}) - ${payment.paidAmount}€ - ${errors.type || 'unknown'}`);
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error verifying test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
if (require.main === module) {
  console.log('🎯 MyCoolPay Test Failed Payments Insertion');
  console.log('==========================================');
  console.log('');
  
  insertTestFailedPayments()
    .then(() => verifyTestData())
    .catch(console.error);
}

export { insertTestFailedPayments, verifyTestData };