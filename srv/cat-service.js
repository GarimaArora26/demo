const cds = require("@sap/cds");
const xlsx = require("xlsx");
const fileStream = require("stream");


module.exports = (srv) => {
  const { Books } = srv.entities;

 
  // ********************************** Books creation using excel upload ********************************************************

  srv.on("PUT", "BooksExcelUpload",async (req) => {
    if (req.data.excel) {
      console.log("***********")
      var entity = req.headers.slug;
      const stream = new fileStream.PassThrough();
      var buffers = [];
      let tableName = "MY_ESG_REPORTINGQUESTIONNAIRE_SUPPLIERS",
        tquery = "",
        tableMetaData,
        excelAttributeMissingInDB = [],
        updateSupDataInValidList = [],
        updateResult = [],
        insertSupDataInValidList = [],
        successfulInserts = [],
        insertSupDataInValidMessage = "",
        successfulInsertsMessage = "",
        updateSupDataInValidMessage = "",
        successfulUpdateMessage = "",
        errorMessage = "";
      const tx = cds.transaction(req);
      const dbType = employeeDataUtil.getDBType(tx);
      req.data.excel.pipe(stream);
      await new Promise((resolve, reject) => {
        stream.on("data", (dataChunk) => {
          buffers.push(dataChunk);
        });
        stream.on("end", async () => {
          let buffer = Buffer.concat(buffers);
          let excelWorkbook = xlsx.read(buffer, {
            type: "buffer",
            cellText: true,
            cellDates: true,
            dateNf: 'dd"."mm"."yyyy',
            cellNf: true,
            rawNumbers: false,
          });

          //CheckDB Table Exist
          if (dbType == "sqlite") {
            tquery = `PRAGMA table_info(${tableName})`;
          } else if (dbType == "hana") {
            tquery = `SELECT COLUMN_NAME,DATA_TYPE_NAME,LENGTH,IS_NULLABLE fROM SYS.TABLE_COLUMNS WHERE TABLE_NAME = '${tableName}'`;
          }

          tableMetaData = await tx.run(tquery);
          let columnlistOfTable = [];

          tableMetaData.forEach((row) => {
            if (dbType == "sqlite") {
              columnlistOfTable.push(row.name);
            } else if (dbType == "hana") {
              columnlistOfTable.push(row.COLUMN_NAME);
            }
          });

          if (employeeDataUtil.isNullOrUndefined(columnlistOfTable)) {
            errorMessage = errorMessage.trim() + "Supplier table doesn't exist \n";
          }
          if (employeeDataUtil.isEmptyString(errorMessage)) {

            //Getting excelWorkbook object
            const excelWorksheet = employeeDataUtil.getExcelWorkSheet(excelWorkbook, "supplier");
            let excelTabledata = employeeDataUtil.getExcelDataInJson(excelWorksheet);
            if (employeeDataUtil.isNull(excelTabledata) || employeeDataUtil.isEmptyArray(excelTabledata)) {
              errorMessage = errorMessage.trim() + "fail to access excel rows ";
            }
            if (employeeDataUtil.isEmptyString(errorMessage)) {
              // Extract column names from the first row of the Excel data
              const columnNames = excelTabledata[0];

              //Check attribute in excel is same as column name in table
              if (Object.keys(excelTabledata[0]).length > columnlistOfTable.length) {
                console.log("ERROR:Excel number of column exceeds DB column ");
                errorMessage =
                  errorMessage.trim() +
                  "ERROR: Excel number of column exceeds DB column ,Total Number of column in Excel: " +
                  excelRowOfColumnList.length +
                  " Total number of column in DB " +
                  columnlistOfTable.length +
                  " kindly correct \n\n";
              }
              if (employeeDataUtil.isEmptyString(errorMessage)) {
                excelAttributeMissingInDB = employeeDataUtil.validateExcelHeaderColumn(
                  columnlistOfTable,
                  excelTabledata
                );
                if (!employeeDataUtil.isEmptyArray(excelAttributeMissingInDB)) {
                  console.log(
                    "ERROR: ColumnsNames: " +
                    excelAttributeMissingInDB.join(", ") +
                    " present in excels are not in DataBase table,kindly remove from excel  "
                  );
                  errorMessage =
                    errorMessage.trim() +
                    "ERROR: ColumnsNames: " +
                    excelAttributeMissingInDB.join(", ") +
                    " present in excels are not in DataBase table,kindly remove from excel ";
                }
                if (employeeDataUtil.isEmptyString(errorMessage)) {

                  //Check duplicate rows in excel
                  const duplicateRows = employeeDataUtil.isDuplicateRowInExcel(excelTabledata);
                  if (!employeeDataUtil.isEmptyArray(duplicateRows)) {
                    console.log(
                      " ERROR: Row number " +
                      duplicateRows.join(", ") +
                      " data are  duplicate in excel kindly remove duplicate row from excel"
                    );
                    errorMessage =
                      errorMessage.trim() +
                      " ERROR: Row number " +
                      duplicateRows.join(", ") +
                      " data are  duplicate in excel kindly remove duplicate row from excel ";
                  }

                  if (employeeDataUtil.isEmptyString(errorMessage)) {

                    //fetching CodeList Table Data
                    const fetchCodeListTableData = async (tableName, columns) => {
                      try {
                        const tableData = await tx.run(SELECT.from(tableName).columns(columns));
                        return tableData;
                      } catch (error) {
                        console.log(`Error while fetching ${tableName} data: ${error.message}`);
                        return null;
                      }
                    };

                    let countryListTable;
                    let SupplierTypeTable;
                    const codeListTableDataMap = new Map();

                    countryListTable = await fetchCodeListTableData(CountryList, ["name", "descr", "code"]);
                    SupplierTypeTable = await fetchCodeListTableData(SupplierType, ["name", "descr", "code"]);

                    codeListTableDataMap.set("COUNTRY", countryListTable);
                    codeListTableDataMap.set("SUPPLIERTYPE", SupplierTypeTable);

                    //Excel Row Data for UPDATE
                    let supplierListfromDB = null;
                    try {
                      if (dbType == "sqlite") {
                        supplierListfromDB = await tx.run(
                          SELECT.from(Suppliers).columns(["supplierId"]).where("BINARY supplierId", "!=", null)
                        );
                      } else if (dbType == "hana") {
                        supplierListfromDB = await tx.run(
                          SELECT.from(Suppliers).columns(["supplierId"]).where("SupplierId", "!=", null)
                        );
                      }
                    } catch (error) {
                      console.log("Error while fetching Supplier data " + error.message);
                    }

                    const existingSupplierArr = supplierListfromDB.map((row) => row.supplierId);

                    const updateSupplierDataArr = [];
                    for (const row of excelTabledata) {
                      if (employeeDataUtil.isNullOrUndefined(row[columnNames.indexOf("supplierId")])) {
                        continue;
                      } else if (employeeDataUtil.isEmptyString(row[columnNames.indexOf("supplierId")])) {
                        continue;
                      } else if (
                        employeeDataUtil.isStringElementInArray(row[columnNames.indexOf("supplierId")], existingSupplierArr)
                      ) {
                        updateSupplierDataArr.push(row);
                      }
                    }

                    //Update supplier data into the "Supplier" entity
                    if (updateSupplierDataArr.length === 0) {
                      console.log("No new supplier to Update.");
                    } else {
                      let updateSupDataList = [];
                      let updateErrorMessage = "";
                      for (const updateDataRow of updateSupplierDataArr) {
                        updateErrorMessage = isSupplierRowDataValidForInsertion(
                          updateDataRow,
                          columnNames,
                          codeListTableDataMap
                        );
                        if (employeeDataUtil.isEmptyString(updateErrorMessage)) {

                          //code list
                          let supplierCountry_code = updateDataRow[columnNames.indexOf("supplierCountry_code")];

                          supplierCountry_code = !employeeDataUtil.isNullOrUndefined(supplierCountry_code)
                            ? !employeeDataUtil.isEmptyString(String(supplierCountry_code).trim())
                              ? String(supplierCountry_code).trim()
                              : ""
                            : "";

                          let typeOfSupplier_code = updateDataRow[columnNames.indexOf("typeOfSupplier_code")];

                          typeOfSupplier_code = !employeeDataUtil.isNullOrUndefined(typeOfSupplier_code)
                            ? !employeeDataUtil.isEmptyString(String(typeOfSupplier_code).trim())
                              ? String(typeOfSupplier_code).trim()
                              : ""
                            : "";

                          let createdAt = employeeDataUtil.getDateAsPerDB();
                          let modifiedAt = employeeDataUtil.getDateAsPerDB();
                          let supplierStartDate = updateDataRow[columnNames.indexOf("supplierStartDate")];
                          let supplierEndDate = updateDataRow[columnNames.indexOf("supplierEndDate")];
                          let supplierName = updateDataRow[columnNames.indexOf("supplierName")];
                          let supplierId = updateDataRow[columnNames.indexOf("supplierId")];
                          let supplierName2 = updateDataRow[columnNames.indexOf("supplierName2")];
                          let supplierName3 = updateDataRow[columnNames.indexOf("supplierName3")];

                          let supplierAddress = updateDataRow[columnNames.indexOf("supplierAddress")];
                          supplierAddress = !employeeDataUtil.isNullOrUndefined(supplierAddress)
                            ? !employeeDataUtil.isEmptyString(String(supplierAddress).trim())
                              ? String(supplierAddress).trim()
                              : ""
                            : "";
                          let city = updateDataRow[columnNames.indexOf("city")];
                          let postalCode = String(updateDataRow[columnNames.indexOf("postalCode")]);
                          let houseAndStreet = updateDataRow[columnNames.indexOf("houseAndStreet")];
                          houseAndStreet = !employeeDataUtil.isNullOrUndefined(houseAndStreet)
                            ? !employeeDataUtil.isEmptyString(String(houseAndStreet).trim())
                              ? String(houseAndStreet).trim()
                              : ""
                            : "";

                          let emailAddress = updateDataRow[columnNames.indexOf("emailAddress")];
                          emailAddress = !employeeDataUtil.isNullOrUndefined(emailAddress)
                            ? !employeeDataUtil.isEmptyString(String(emailAddress).trim())
                              ? String(emailAddress).trim()
                              : ""
                            : "";

                          let emailAddres2 = updateDataRow[columnNames.indexOf("emailAddres2")];
                            if(updateDataRow[columnNames.indexOf("emailAddres2")] == "" || updateDataRow[columnNames.indexOf("emailAddres2")] == undefined){
                              emailAddres2 = "";
                            }else{
                              if(validateEmail(updateDataRow[columnNames.indexOf("emailAddres2")])){
                                emailAddres2 = !employeeDataUtil.isNullOrUndefined(emailAddres2)
                              ? !employeeDataUtil.isEmptyString(String(emailAddres2).trim())
                                ? String(emailAddres2).trim()
                                : "" 
                              : "";
                              }else{
                                req.error(400, `Update failed for Supplier ${(updateDataRow[columnNames.indexOf("supplierId")])} Reason: Email 2 is invalid`);
                              }
                            }
                          
                            let emailAddress3 = updateDataRow[columnNames.indexOf("emailAddress3")];
                            if(updateDataRow[columnNames.indexOf("emailAddress3")] == "" || updateDataRow[columnNames.indexOf("emailAddress3")] == undefined){
                              emailAddress3 = "";
                            }else{
                              if(validateEmail(updateDataRow[columnNames.indexOf("emailAddress3")])){
                                emailAddress3 = !employeeDataUtil.isNullOrUndefined(emailAddress3)
                              ? !employeeDataUtil.isEmptyString(String(emailAddress3).trim())
                                ? String(emailAddress3).trim()
                                : "" 
                              : "";
                              }else{
                                req.error(400, `Update faied for Supplier ${(updateDataRow[columnNames.indexOf("supplierId")])} Reason: Email 3 is invalid`)
                              }
                            }

                          let updateSupData = {};
                          updateSupData = {
                            createdAt: createdAt,
                            createdBy: "anonymous",
                            modifiedAt: modifiedAt,
                            modifiedBy: "anonymous",
                            ID: cds.utils.uuid(),
                            supplierId: supplierId,
                            supplierName: supplierName,
                            supplierName2: supplierName2,
                            supplierName3: supplierName3,
                            supplierCountry_code: supplierCountry_code,
                            typeOfSupplier_code: typeOfSupplier_code,
                            supplierAddress: supplierAddress,
                            emailAddress: emailAddress,
                            emailAddres2: emailAddres2,
                            emailAddress3: emailAddress3,
                            supplierStartDate: supplierStartDate,
                            supplierEndDate: supplierEndDate,
                            city: city,
                            postalCode: postalCode,
                            houseAndStreet: houseAndStreet
                          };
                          updateSupDataList.push(updateSupData);
                        } else {
                          updateSupDataInValidList.push(updateErrorMessage);
                        }
                      }
                      let affectedRows = 0;
                      if (dbType == "sqlite") {
                        try {
                          if (updateSupDataList != null && updateSupDataList.length > 0) {
                            const updatePromises = updateSupDataList.map(async (row) => {
                              const { supplierId, ...updateData } = row;
                              try {
                                const result = await tx.run(UPDATE(Suppliers).set(updateData).where({ supplierId }));
                                if (!employeeDataUtil.isNullOrUndefined(supplierId)) updateResult.push(supplierId);
                              } catch (error) {
                                console.error(`Update failed for supplier ID ${supplierId}. Error:`, error);
                                updateSupDataInValidList.push(supplierId + " Reason: " + error.message);
                              }
                            });
                            await Promise.all(updatePromises);
                          }
                        } catch (error) {
                          console.log(error);
                          updateSupDataInValidList.push(error.message);
                        }
                      } else if (dbType == "hana") {
                        let supId = "";

                        if (updateSupDataList != null && updateSupDataList.length > 0) {
                          for (let count = 0; count < updateSupDataList.length; count++) {
                            supId = updateSupDataList[count].supplierId;
                            try {
                              const result = await tx.run(
                                UPDATE(Suppliers)
                                  .set(updateSupDataList[count])
                                  .where({ supplierId: updateSupDataList[count].supplierId })
                              );
                              if (result === 1) {
                                updateResult.push(supId);
                              } else {
                                updateSupDataInValidList.push(supId);
                              }
                            } catch (error) {
                              console.error("Update failed for supplier ID number " + supId + ". Error:", error);
                              updateSupDataInValidList.push(supId + " Reason: " + error.message);
                            }
                          }
                        }
                      }
                    }

                    //Excel Row Data for INSERT
                    const insertSupDataArr = [];
                    for (const row of excelTabledata) {
                      if (employeeDataUtil.isNullOrUndefined(row[columnNames.indexOf("supplierId")])) {
                        continue;
                      } else if (employeeDataUtil.isEmptyString(row[columnNames.indexOf("supplierId")])) {
                        continue;
                      } else if (
                        employeeDataUtil.isStringElementInArray(row[columnNames.indexOf("supplierId")], columnNames)
                      ) {
                        continue;
                      } else if (
                        !employeeDataUtil.isStringElementInArray(row[columnNames.indexOf("supplierId")], existingSupplierArr)
                      ) {
                        insertSupDataArr.push(row);
                      }
                    }

                    // Insert supplier data into the "Supplier" entity
                    if (insertSupDataArr.length === 0) {
                      console.log("No new supplier to insert.");
                    } else {
                      let insertSupDataList = [];
                      for (const insertDataRow of insertSupDataArr) {
                        let errorMessage = isSupplierRowDataValidForInsertion(
                          insertDataRow,
                          columnNames,
                          codeListTableDataMap
                        );
                        if (employeeDataUtil.isEmptyString(errorMessage)) {

                          //code list
                          let supplierCountry_code = insertDataRow[columnNames.indexOf("supplierCountry_code")];

                          supplierCountry_code = !employeeDataUtil.isNullOrUndefined(supplierCountry_code)
                            ? !employeeDataUtil.isEmptyString(String(supplierCountry_code).trim())
                              ? String(supplierCountry_code).trim()
                              : ""
                            : "";

                          let typeOfSupplier_code = insertDataRow[columnNames.indexOf("typeOfSupplier_code")];

                          typeOfSupplier_code = !employeeDataUtil.isNullOrUndefined(typeOfSupplier_code)
                            ? !employeeDataUtil.isEmptyString(String(typeOfSupplier_code).trim())
                              ? String(typeOfSupplier_code).trim()
                              : ""
                            : "";

                          let createdAt = employeeDataUtil.getDateAsPerDB();
                          let modifiedAt = employeeDataUtil.getDateAsPerDB();
                          let supplierStartDate = insertDataRow[columnNames.indexOf("supplierStartDate")];
                          let supplierEndDate = insertDataRow[columnNames.indexOf("supplierEndDate")];
                          let supplierName = insertDataRow[columnNames.indexOf("supplierName")];
                          let supplierId = insertDataRow[columnNames.indexOf("supplierId")];
                          let supplierName2 = insertDataRow[columnNames.indexOf("supplierName2")];
                          let supplierName3 = insertDataRow[columnNames.indexOf("supplierName3")];

                          let supplierAddress = insertDataRow[columnNames.indexOf("supplierAddress")];
                          supplierAddress = !employeeDataUtil.isNullOrUndefined(supplierAddress)
                            ? !employeeDataUtil.isEmptyString(String(supplierAddress).trim())
                              ? String(supplierAddress).trim()
                              : ""
                            : "";
                          let city = insertDataRow[columnNames.indexOf("city")];
                          city = !employeeDataUtil.isNullOrUndefined(city)
                            ? !employeeDataUtil.isEmptyString(String(city).trim())
                              ? String(city).trim()
                              : ""
                            : "";
                          let postalCode = insertDataRow[columnNames.indexOf("postalCode")];
                          postalCode = !employeeDataUtil.isNullOrUndefined(postalCode)
                            ? !employeeDataUtil.isEmptyString(String(postalCode).trim())
                              ? String(postalCode).trim()
                              : ""
                            : "";
                          let houseAndStreet = insertDataRow[columnNames.indexOf("houseAndStreet")];
                          houseAndStreet = !employeeDataUtil.isNullOrUndefined(houseAndStreet)
                            ? !employeeDataUtil.isEmptyString(String(houseAndStreet).trim())
                              ? String(houseAndStreet).trim()
                              : ""
                            : "";

                          let emailAddress = insertDataRow[columnNames.indexOf("emailAddress")];
                          emailAddress = !employeeDataUtil.isNullOrUndefined(emailAddress)
                            ? !employeeDataUtil.isEmptyString(String(emailAddress).trim())
                              ? String(emailAddress).trim()
                              : ""
                            : "";

                          let emailAddres2 = insertDataRow[columnNames.indexOf("emailAddres2")];
                          if(insertDataRow[columnNames.indexOf("emailAddres2")] == "" || insertDataRow[columnNames.indexOf("emailAddres2")] == undefined){
                            emailAddres2 = ""
                          }else{
                            if(validateEmail(insertDataRow[columnNames.indexOf("emailAddres2")])){
                              emailAddres2 = !employeeDataUtil.isNullOrUndefined(emailAddres2)
                              ? !employeeDataUtil.isEmptyString(String(emailAddres2).trim())
                                ? String(emailAddres2).trim()
                                : ""
                              : "";
                            }
                              else{
                              req.error(400, `Insert failed for Supplier ${(insertDataRow[columnNames.indexOf("supplierId")])} Reason: Email 2 is invalid`);
                            }
                          }

                          let emailAddress3 = insertDataRow[columnNames.indexOf("emailAddress3")];
                          if(insertDataRow[columnNames.indexOf("emailAddress3")] == "" || insertDataRow[columnNames.indexOf("emailAddress3")] == undefined){
                            emailAddress3 = "";
                          }else{
                            if(validateEmail(insertDataRow[columnNames.indexOf("emailAddress3")])){
                              emailAddress3 = !employeeDataUtil.isNullOrUndefined(emailAddress3)
                            ? !employeeDataUtil.isEmptyString(String(emailAddress3).trim())
                              ? String(emailAddress3).trim()
                              : "" 
                            : "";
                            }else{
                              req.error(400, `Insert failed for Supplier ${(insertDataRow[columnNames.indexOf("supplierId")])} Reason: Email 3 is invalid`);
                            }
                          }

                          let insertSupData = {};
                          insertSupData = {
                            createdAt: createdAt,
                            createdBy: "anonymous",
                            modifiedAt: modifiedAt,
                            modifiedBy: "anonymous",
                            ID: cds.utils.uuid(),
                            supplierId: supplierId,
                            supplierName: supplierName,
                            supplierName2: supplierName2,
                            supplierName3: supplierName3,
                            supplierCountry_code: supplierCountry_code,
                            typeOfSupplier_code: typeOfSupplier_code,
                            supplierAddress: supplierAddress,
                            emailAddress: emailAddress,
                            emailAddres2: emailAddres2,
                            emailAddress3: emailAddress3,
                            supplierStartDate: supplierStartDate,
                            supplierEndDate: supplierEndDate,
                            city: city,
                            postalCode: postalCode,
                            houseAndStreet: houseAndStreet,
                          };
                          insertSupDataList.push(insertSupData);
                        } else {
                          insertSupDataInValidList.push(errorMessage);
                        }
                      }
                      let insertResult;
                      try {
                        if (insertSupDataList != null && insertSupDataList.length > 0) {
                        }
                        if (dbType == "sqlite") {
                          insertResult = await tx.run(
                            INSERT.into(Suppliers).entries(insertSupDataList, { returnAffectedRows: true })
                          );
                          if (
                            insertResult !== null &&
                            insertResult.results !== null &&
                            insertResult.results.length > 0
                          ) {
                            for (let count = 0; count < insertResult.results.length; count++) {
                              if (insertResult.results[0].affectedRows === 1) {
                                successfulInserts.push(insertResult.results[count].values[5]);
                              } else if (insertResult.results[0].affectedRows !== 1) {
                                insertSupDataInValidList.push(
                                  "for Supplier ID: " + insertResult.results[count].values[5] + " insertion is failed"
                                );
                              }
                            }
                          }
                        } else if (dbType == "hana") {
                          let supId = "";
                          if (insertSupDataList != null && insertSupDataList.length > 0) {
                            for (let count = 0; count < insertSupDataList.length; count++) {
                              try {
                                supId = insertSupDataList[count].supplierId;
                                insertResult = await tx.run(INSERT.into(Suppliers).entries(insertSupDataList[count]));
                                if (
                                  insertResult !== null &&
                                  insertResult.results !== null &&
                                  insertResult.results.length > 0
                                ) {
                                  if (insertResult.results[0].affectedRows === 1) {
                                    successfulInserts.push(insertResult.results[0].values[5]);
                                  } else if (insertResult.results[0].affectedRows !== 1) {

                                    insertSupDataInValidList.push(supId);
                                  }
                                }
                              } catch (error) {

                                insertSupDataInValidList.push(supId + " Reason: " + error.message);
                              }
                            }
                          }

                        }
                      } catch (error) {
                        console.log(error);
                        insertSupDataInValidList.push(error.message);
                      }
                    }

                    for (let count = 0; count < insertSupDataInValidList.length; count++) {
                      insertSupDataInValidMessage = employeeDataUtil.isEmptyString(insertSupDataInValidMessage)
                        ? insertSupDataInValidMessage.trim() + " Supplier creation failed " + insertSupDataInValidList[count]
                        : insertSupDataInValidMessage.trim() + " Supplier creation failed " + insertSupDataInValidList[count];
                    }
                    for (let count = 0; count < successfulInserts.length; count++) {
                      successfulInsertsMessage = employeeDataUtil.isEmptyString(successfulInsertsMessage)
                        ? successfulInsertsMessage.trim() + " Supplier created with Supplier ID: " + successfulInserts[count]
                        : successfulInsertsMessage.trim() + " Supplier created with Supplier ID: " + successfulInserts[count];
                    }

                    for (let count = 0; count < updateSupDataInValidList.length; count++) {
                      updateSupDataInValidMessage = employeeDataUtil.isEmptyString(updateSupDataInValidMessage)
                        ? updateSupDataInValidMessage.trim() + " Update failed " + updateSupDataInValidList[count]
                        : updateSupDataInValidMessage.trim() + " Update failed " + updateSupDataInValidList[count];
                    }

                    for (let count = 0; count < updateResult.length; count++) {
                      successfulUpdateMessage = employeeDataUtil.isEmptyString(successfulUpdateMessage)
                        ? successfulUpdateMessage.trim() + " Update successful " + updateResult[count]
                        : successfulUpdateMessage.trim() + " Update successful " + updateResult[count];
                    }
                  } 
                }
              }
            }
          }
          let uploadError = `${insertSupDataInValidMessage} ${updateSupDataInValidMessage}`
          // if(insertSupDataInValidMessage != ""){
          //   req.error(insertSupDataInValidMessage );
          // }else if(updateSupDataInValidMessage != ""){
          //   req.error(updateSupDataInValidMessage);
          // }

          // if(insertSupDataInValidMessage != "" && updateSupDataInValidMessage != ""){
          //   req.error(`Insert: ${insertSupDataInValidMessage}  Update: ${updateSupDataInValidMessage}`)
          // }
          
          if(insertSupDataInValidMessage != "" || updateSupDataInValidMessage != ""){
            req.error(400, uploadError);
          }

          let trace =
            `${insertSupDataInValidMessage}
          ${successfulInsertsMessage}
          ${updateSupDataInValidMessage}
          ${successfulUpdateMessage}`
          console.log("trace: " + trace.toString().trim().replace(",", ""));

          if (errorMessage != null && !employeeDataUtil.isEmptyString(errorMessage)) {
            reject(req.error(400, JSON.stringify(errorMessage)));
          }

          if (trace.toString() != null) {
            trace = trace.toString().trim().replace(",", "");
            resolve(
              req.notify({
                message: trace.toString(),
                status: 200,
              })
            );
          }
        });
      });

    } else {
      return next();
    }
    

    // Row validation for supplier
    function isSupplierRowDataValidForInsertion(insertDataRow, columnNames, codeListTableDataMap) {
      let errorMessage = "";
      let supplierId = insertDataRow[columnNames.indexOf("supplierId")]
      let supplierName = insertDataRow[columnNames.indexOf("supplierName")];
      let emailAddress = validateEmail(insertDataRow[columnNames.indexOf("emailAddress")]) ? insertDataRow[columnNames.indexOf("emailAddress")] : "";
      let supplierStartDate = isValidTimestamp(insertDataRow[columnNames.indexOf("supplierStartDate")]) ? insertDataRow[columnNames.indexOf("supplierStartDate")] : "";
      let supplierEndDate = isValidTimestamp(insertDataRow[columnNames.indexOf("supplierEndDate")]) ? insertDataRow[columnNames.indexOf("supplierEndDate")] : "";
      let postalCode = insertDataRow[columnNames.indexOf("postalCode")];
      let supplierCountry_code = insertDataRow[columnNames.indexOf("supplierCountry_code")];
      let typeOfSupplier_code = insertDataRow[columnNames.indexOf("typeOfSupplier_code")];
      // let emailAddres2 = validateEmail(insertDataRow[columnNames.indexOf("emailAddres2")]) ? insertDataRow[columnNames.indexOf("emailAddres2")] : req.error("emailAddress2 is invald, please enter valid email");

      //checking for the mandatory attributes
      if (employeeDataUtil.isNullOrUndefined(supplierId) || employeeDataUtil.isEmptyString(supplierId)) {
        errorMessage = "Supplier ID is Empty ";
        return errorMessage;
      } else {
        errorMessage = "For Supplier " + supplierId + " Reason: ";

        if (employeeDataUtil.isNullOrUndefined(supplierName) || employeeDataUtil.isEmptyString(supplierName)) {
          errorMessage = errorMessage + " Supplier Name is Empty ,\n";
        }
        if (employeeDataUtil.isNullOrUndefined(emailAddress) || employeeDataUtil.isEmptyString(emailAddress)) {
          errorMessage = errorMessage + " Email Address is Empty or invalid,\n";
        }
        if (employeeDataUtil.isNullOrUndefined(supplierStartDate) || employeeDataUtil.isEmptyString(supplierStartDate)) {
          errorMessage = errorMessage + " Supplier Start Date is Empty or invalid timestamp ,\n";
        }
        if (employeeDataUtil.isNullOrUndefined(supplierEndDate) || employeeDataUtil.isEmptyString(supplierEndDate)) {
          errorMessage = errorMessage + " Supplier End Date is Empty or invalid timestamp,\n";
        }
        if (employeeDataUtil.isNullOrUndefined(postalCode) || employeeDataUtil.isEmptyString(postalCode)) {
          errorMessage = errorMessage + " postalCode is Empty " + ",\n";
        }
        if (employeeDataUtil.isNullOrUndefined(supplierCountry_code) || employeeDataUtil.isEmptyString(supplierCountry_code)) {
          errorMessage = errorMessage + " supplierCountry_code is Empty " + ",\n";
        } else {
          const countryCodeTable = codeListTableDataMap.get("COUNTRY");
          let countryColumnlistOfTable = employeeDataUtil.getTableArrayByColumn(countryCodeTable, "code");
          if (!employeeDataUtil.isStringElementInArray(supplierCountry_code, countryColumnlistOfTable)) {
            errorMessage = `${errorMessage} supplier country code ${supplierCountry_code} is invalid.`
          }
        }

        if (employeeDataUtil.isNullOrUndefined(typeOfSupplier_code) || employeeDataUtil.isEmptyString(typeOfSupplier_code)) {
          errorMessage = errorMessage + " supplierCountry_code is Empty " + ",\n";
        } else {
          const supplierCodeTable = codeListTableDataMap.get("SUPPLIERTYPE");
          let supplierColumnlistOfTable = employeeDataUtil.getTableArrayByColumn(supplierCodeTable, "code");
          if (!employeeDataUtil.isStringElementInArray(typeOfSupplier_code, supplierColumnlistOfTable)) {
            errorMessage = `${errorMessage} supplier type code ${typeOfSupplier_code} is invalid.`
          }
        }

      }
      errorMessage =
        errorMessage === supplierId + " is Empty " || errorMessage === "For Supplier " + supplierId + " Reason: "
          ? ""
          : errorMessage;
      errorMessage = !employeeDataUtil.isNull(errorMessage) != null && !employeeDataUtil.isEmptyString(errorMessage) ? errorMessage : "";
      return errorMessage;
    }

  });
};

