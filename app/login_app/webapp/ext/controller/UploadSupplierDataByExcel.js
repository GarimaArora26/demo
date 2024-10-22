sap.ui.define(["sap/m/MessageToast"], function (MessageToast) {
    'use strict';

    function uploadSupplier(oExtensionAPI, Entity) {
        var oUploadDialog;

        function setOkButtonEnabled(bOk) {
            oUploadDialog && oUploadDialog.getBeginButton().setEnabled(bOk);
        }

        function setDialogBusy(bBusy) {
            oUploadDialog.setBusy(bBusy);
        }

        function closeDialog() {
            oUploadDialog && oUploadDialog.close();
        }

        function showError(code, target, sMessage) {
            sap.m.MessageBox.show(sMessage, {
                icon: sap.m.MessageBox.Icon.ERROR,
                title: "ERROR",
            });
        }

        function byId(sId) {
            return sap.ui.core.Fragment.byId("UploadSupplierDataByExcelDialog", sId);
        }

        return {
            onBeforeOpen: function (oEvent) {
                oUploadDialog = oEvent.getSource();
                oExtensionAPI.addDependent(oUploadDialog);
            },

            onAfterClose: function (oEvent) {
                oExtensionAPI.removeDependent(oUploadDialog);
                oUploadDialog.destroy();
                oUploadDialog = undefined;
            },

            onOk: function (oEvent) {
                setDialogBusy(true);

                var oFileUploader = byId("supplierUploader");
                var headPar = new sap.ui.unified.FileUploaderParameter();
                headPar.setName("slug");
                headPar.setValue(Entity);
                oFileUploader.removeHeaderParameter("slug");
                oFileUploader.addHeaderParameter(headPar);
                var baseURI = oFileUploader.oFileUpload.baseURI;
                console.log(baseURI);
                const relativePath = "/odata/v4/service/supplierService/SupplierExcelUpload/excel";
                const url = window.location.href.includes("localhost") || window.location.href.includes("port4004")
                    ? relativePath
                    : jQuery.sap.getModulePath("ns.suppliers", relativePath);
                console.log(url);
                oFileUploader.setUploadUrl(url);
                oFileUploader
                    .checkFileReadable()
                    .then(function () {
                        oFileUploader.upload();
                    })
                    .catch(function (error) {
                        showError("The file cannot be read.");
                        setDialogBusy(false);
                    });
            },

            onCancel: function (oEvent) {
                closeDialog();
            },

            onTypeMismatch: function (oEvent) {
                var sSupportedFileTypes = oEvent
                    .getSource()
                    .getFileType()
                    .map(function (sFileType) {
                        return "*." + sFileType;
                    })
                    .join(", ");

                showError(
                    "The file type *." +
                    oEvent.getParameter("fileType") +
                    " is not supported. Choose one of the following types: " +
                    sSupportedFileTypes
                );
            },

            onFileAllowed: function (oEvent) {
                setOkButtonEnabled(true);
            },

            onFileEmpty: function (oEvent) {
                setOkButtonEnabled(false);
            },

            onUploadComplete: function (oEvent) {
                var iStatus = oEvent.getParameter("status");
                var oFileUploader = oEvent.getSource();
                var response = oEvent.getParameter("responseRaw");

                oFileUploader.clear();
                setOkButtonEnabled(false);
                setDialogBusy(false);

                var headers = oEvent.mParameters.headers;
                var message = headers["sap-messages"];
                const supLogMsg = JSON.parse(message)[0].message;

                if (iStatus >= 400) {
                    var oRawResponse;
                    try {
                        oRawResponse = JSON.parse(oEvent.getParameter("responseRaw"));
                    } catch (e) {
                        oRawResponse = oEvent.getParameter("responseRaw");
                    }
                    if (oRawResponse && oRawResponse.error && oRawResponse.error.message && oRawResponse.error.details == null) {
                        showError(
                            oRawResponse.error.code,
                            oRawResponse.error.target,
                            oRawResponse && oRawResponse.error && oRawResponse.error.message
                        );
                        closeDialog();
                    }
                    let errorDetails = "";
                    if (oRawResponse.error.details) {
                        const uploadError = oRawResponse.error.details;
                        console.log(uploadError);
                        if (uploadError !== null && uploadError.length > 0) {
                            const messages = uploadError.map(item => item.message);
                            errorDetails = messages.join('\n');
                            console.log(errorDetails);
                        }
                        // Create a JSON model for error log
                        var oModel = new sap.ui.model.json.JSONModel({
                            items: [{ text: errorDetails }],
                        });
                        // Create a table with a single column to display the long string
                        var oTable = new sap.m.Table({
                            columns: [
                                new sap.m.Column({
                                    header: new sap.m.Text({ text: "Error Details" }),
                                    width: "50px",
                                }),
                            ],
                            items: {
                                path: "/items",
                                template: new sap.m.ColumnListItem({
                                    cells: [new sap.m.Text({ text: "{text}" })],
                                }),
                            },
                        });
                        oTable.setModel(oModel);
                        sap.m.MessageBox.error("Multiple errors occurred. Please see the details for more information.", {
                            actions: ["Show Details", sap.m.MessageBox.Action.CLOSE],
                            emphasizedAction: "Show Details",
                            onClose: function (sAction) {
                                if (sAction === "Show Details") {
                                    console.log("Action selected: " + sAction);
                                    var oCustomDialog = new sap.m.Dialog({
                                        title: "Position Upload Log",
                                        content: [oTable],
                                        contentWidth: "700px",
                                        buttons: [
                                            new sap.m.Button({
                                                text: "Close",
                                                press: function () {
                                                    oCustomDialog.close();
                                                },
                                            }),
                                        ],
                                    });
                                    oCustomDialog.open();
                                }
                            },
                        });
                    }
                } else {
                    // MessageToast.show("File uploaded successfully");
                    // Create a JSON model for error log
                    var oModel = new sap.ui.model.json.JSONModel({
                        items: [{ text: supLogMsg }],
                    });

                    // Create a table with a single column to display the long string
                    var oTable = new sap.m.Table({
                        columns: [
                            new sap.m.Column({
                                header: new sap.m.Text({ text: "Logs" }),
                                width: "50px",
                            }),
                        ],
                        items: {
                            path: "/items",
                            template: new sap.m.ColumnListItem({
                                cells: [new sap.m.Text({ text: "{text}" })],
                            }),
                        },
                    });
                    oTable.setModel(oModel);

                    sap.m.MessageBox.success("File uploaded successfully.", {
                        actions: ["Show Log", sap.m.MessageBox.Action.CLOSE],
                        emphasizedAction: "Show Log",
                        onClose: function (sAction) {
                            if (sAction === "Show Log") {
                                console.log("Action selected: " + sAction);
                                var oCustomDialog = new sap.m.Dialog({
                                    title: "Supplier Upload Log",
                                    content: [oTable],
                                    contentWidth: "700px",
                                    buttons: [
                                        new sap.m.Button({
                                            text: "Close",
                                            press: function () {
                                                oCustomDialog.close();
                                            },
                                        }),
                                    ],
                                });
                                oCustomDialog.open();
                            }
                        },
                    });

                    oExtensionAPI.refresh();
                    closeDialog();
                }
            },
        };
    }

    return {
        uploadSupplier: function (oBindingContext, aSelectedContexts) {
            this.loadFragment({
                id: "UploadSupplierDataByExcelDialog",
                name: "loginapp.ext.fragment.UploadSupplierDataByExcelDialog",
                controller: uploadSupplier(this, "Suppliers"),
            }).then(function (oDialog) {
                oDialog.open();
            });
        }
    };
});
