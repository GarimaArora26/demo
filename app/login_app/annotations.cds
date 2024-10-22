using CatalogService as service from '../../srv/cat-service';
annotate service.Books with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'ID',
                Value : ID,
            },
            {
                $Type : 'UI.DataField',
                Label : 'title',
                Value : title,
            },
            {
                $Type : 'UI.DataField',
                Label : 'stock',
                Value : stock,
            },
            {
                $Type : 'UI.DataField',
                Label : 'country',
                Value : country,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'ID',
            Value : ID,
        },
        {
            $Type : 'UI.DataField',
            Label : 'title',
            Value : title,
        },
        {
            $Type : 'UI.DataField',
            Label : 'stock',
            Value : stock,
        },
        {
            $Type : 'UI.DataField',
            Label : 'country',
            Value : country,
        },
    ],
);

//  Common.SideEffects : {
//         $Type : 'Common.SideEffectsType',
//         SourceProperties : [
//             'country'
//         ],
//         TargetEntities : [
//             'validateCountry'
//         ]
//     },
//     UI.ValidationFunction : 'validateCountry'
// );

// // Add country-specific annotations
// annotate service.Books with {
//     country @(
//         Common.ValueListWithFixedValues: true,
//         Common.ValueList : {
//             Label : 'Countries',
//             CollectionPath : 'user.country',
//             Parameters : [
//                 {
//                     $Type : 'Common.ValueListParameterInOut',
//                     ![@UI.Importance] : #High,
//                     LocalDataProperty : country,
//                     ValueListProperty : 'user.country'
//                 }
//             ]
//         },
//         // Common.FieldControl : #Mandatory
//     );
// };
