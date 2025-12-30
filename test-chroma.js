const { ChromaClient } = require('chromadb');

async function checkChunks() {
  const client = new ChromaClient({
    path: 'http://localhost:8000'
  });

  try {
    // Step 1: list collections (metadata only)
    const collections = await client.listCollections();
    console.log('Collections:', collections.map(c => c.name));

    if (collections.length === 0) {
      console.log('❌ NO COLLECTIONS FOUND');
      return;
    }

    // Step 2: re-fetch the actual collection object
    const collection = await client.getCollection({
      name: 'finance_textbooks'
    });

    // Step 3: now you can query documents
    const result = await collection.get({ limit: 5 });

    console.log(`✅ Retrieved ${result.ids.length} chunks`);

    if (result.documents && result.documents.length > 0) {
      console.log('\n📄 First chunk preview:\n');
      console.log(result.documents[0].substring(0, 300) + '...');
    } else {
      console.log('❌ No documents found');
    }

  } catch (error) {
    console.error('❌ Error inspecting ChromaDB:', error.message);
  }
}

checkChunks();