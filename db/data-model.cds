namespace my.bookshop;

@odata.draft.enabled
entity Books @(restrict: [{
  // grant: 'READ',
  to   : 'readers',
  where: 'country = $user.country'
  // where: 'country = $user.locale'
}]) {
  key ID      : Integer;
      title   : String;
      stock   : Integer;
      country : String(2);
}

