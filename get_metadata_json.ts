//William Ambrozic 2022
//Code adapted from https://solanacookbook.com/references/nfts.html#candy-machine-v1
import config from './config.json';
import { Connection, clusterApiUrl, PublicKey } from '@solana/web3.js';
import { Metadata } from '@metaplex-foundation/mpl-token-metadata';
import bs58 from 'bs58';
import axios from "axios"
import * as fs from 'fs';

const connection = new Connection(config.data.RPC);
const MAX_NAME_LENGTH = 32;
const MAX_URI_LENGTH = 200;
const MAX_SYMBOL_LENGTH = 10;
const MAX_CREATOR_LEN = 32 + 1 + 1;
const MAX_CREATOR_LIMIT = 5;
const MAX_DATA_SIZE = 4 + MAX_NAME_LENGTH + 4 + MAX_SYMBOL_LENGTH + 4 + MAX_URI_LENGTH + 2 + 1 + 4 + MAX_CREATOR_LIMIT * MAX_CREATOR_LEN;
const MAX_METADATA_LEN = 1 + 32 + 32 + MAX_DATA_SIZE + 1 + 1 + 9 + 172;
const CREATOR_mintAddrAY_START = 1 + 32 + 32 + 4 + MAX_NAME_LENGTH + 4 + MAX_URI_LENGTH + 4 + MAX_SYMBOL_LENGTH + 2 + 1 + 4;

const TOKEN_METADATA_PROGRAM = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
const candyMachineId = new PublicKey(config.data.mint_id);

const getMintAddresses = async (firstCreatorAddress: PublicKey) => {
  const metadataAccounts = await connection.getProgramAccounts(
    TOKEN_METADATA_PROGRAM,
    {
      // The mint address is located at byte 33 and lasts for 32 bytes.
      dataSlice: { offset: 33, length: 32 },

      filters: [
        // Only get Metadata accounts.
        { dataSize: MAX_METADATA_LEN },

        // Filter using the first creator.
        {
          memcmp: {
            offset: CREATOR_mintAddrAY_START,
            bytes: firstCreatorAddress.toBase58(),
          },
        },
      ],
    },
  );

  return metadataAccounts.map((metadataAccountInfo) => (
    bs58.encode(metadataAccountInfo.account.data)
  ));
};

(async () => {
   console.log("Fetching Mint Addresses (this may take a few minutes, sit back)");

   let mintAddr = []
   //Getting mint addresses from candy machine ID or saved JSON
   try {
     let mint = require('./mint_addr/' + config.data.mint_id + ".json");
     mintAddr = mint.mint_addr;
     console.log("Found mint addresses from local JSON file");
   } catch (error) {
     mintAddr = await getMintAddresses(candyMachineId);
     let save_json = {mint_addr: mintAddr};
     if (!fs.existsSync("./mint_addr")){
       fs.mkdirSync("./mint_addr");
     }
     fs.writeFile ("./mint_addr/" + config.data.mint_id + ".json", JSON.stringify(save_json), function(err:any) {
      if (err) throw err;
      });
   }

   let success = true;

   if (!fs.existsSync("./metadata")){
	   fs.mkdirSync("./metadata");
   }
   if (!fs.existsSync("./metadata/" + config.data.mint_id + "/")){
	   fs.mkdirSync("./metadata/" + config.data.mint_id + "/");
   }
   for (let i = 0; i < mintAddr.length; i++) {
     try {
     console.log("(" + (i+1) + "/" + mintAddr.length + ") Fetching " + mintAddr[i]);
     const metadataPDA = await Metadata.getPDA(new PublicKey(mintAddr[i]));
     const tokenMetadata = await Metadata.load(connection, metadataPDA);
     const result = await axios.get(tokenMetadata.data.data.uri)
     fs.writeFile ("./metadata/" + config.data.mint_id + "/" + result.data.name + ".json", JSON.stringify(result.data, null, "\t"), function(err:any) {
	     if (err) throw err;
     });
     success = true;
   } catch {
     if (success == true) {
      console.log("(" + (i+1) + "/" + mintAddr.length + ") Error Fetching " + mintAddr[i] + " - Trying Again");
      success = false;
    }
     i--;
     continue;
   }
   }
})()
